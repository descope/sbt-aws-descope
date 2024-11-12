import {
  PythonFunction,
  PythonLayerVersion,
} from "@aws-cdk/aws-lambda-python-alpha";
import { aws_logs as AwsLogs, CustomResource, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Runtime, IFunction, LayerVersion } from "aws-cdk-lib/aws-lambda";
import * as sbt from "@cdklabs/sbt-aws";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { addTemplateTag } from "@cdklabs/sbt-aws";
import { NagSuppressions } from "cdk-nag";

/**
 * Properties for the DescopeAuth construct.
 */
export interface DescopeAuthProps {
  /**
   * Descope Project ID.
   * This is to make calls to Descope Management APIs.
   */
  readonly projectId: string;

  /**
   * Override the base URL for the well-known configuration.
   * @default defaultdomain
   */
  readonly domain?: string;

  /**
   * The callback URL for the control plane.
   * @default 'http://localhost'
   */
  readonly controlPlaneCallbackURL?: string;

  /**
   * Whether or not to specify scopes for validation at the API GW.
   * Can be used for testing purposes.
   * @default true
   */
  readonly setAPIGWScopes?: boolean;

  /**
   * Name of SSM parameter containing Descope management key.
   * This is to make calls to Descope Management APIs.
   */
  readonly clientSecretSSMMgmtKey: string;
}

export interface CreateMachineClientProps {
  readonly name: string;
  readonly description: string;
}

/*
 * Function for setting Base Url based on Project ID
 */
function baseUrlForProjectId(projectId: string): string {
  const DEFAULT_URL_PREFIX = "https://api";
  const DEFAULT_DOMAIN = "descope.com";
  const DEFAULT_BASE_URL = `${DEFAULT_URL_PREFIX}.${DEFAULT_DOMAIN}`;

  if (projectId && projectId.length >= 32) {
    const region = projectId.substring(1, 5);
    return `${DEFAULT_URL_PREFIX}.${region}.${DEFAULT_DOMAIN}`;
  }
  return DEFAULT_BASE_URL;
}

export class DescopeAuth extends Construct implements sbt.IAuth {
  readonly jwtIssuer: string;
  readonly jwtAudience: string[];
  readonly managementBaseUrl: string;
  readonly tokenEndpoint: string;
  readonly userClientId: string;
  readonly machineClientId: string;
  readonly machineClientSecret: cdk.SecretValue;
  readonly wellKnownEndpointUrl: string;
  readonly createUserFunction: lambda.IFunction;
  readonly fetchAllUsersFunction: lambda.IFunction;
  readonly fetchUserFunction: lambda.IFunction;
  readonly updateUserFunction: lambda.IFunction;
  readonly deleteUserFunction: lambda.IFunction;
  readonly disableUserFunction: lambda.IFunction;
  readonly enableUserFunction: lambda.IFunction;

  private readonly createAdminUserFunction: lambda.IFunction;
  private readonly createClientFunction: lambda.IFunction;
  private readonly defaultDomain: string;

  constructor(scope: Construct, id: string, props: DescopeAuthProps) {
    super(scope, id);
    addTemplateTag(this, "DescopeAuth");

    /*
     * Sets SSM Parameter for Secret Management Key
     */
    const clientSecretSSMMgmtKey =
      ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        "clientSecretSSMParameterName",
        {
          parameterName: props.clientSecretSSMMgmtKey,
        }
      );

    // https://docs.powertools.aws.dev/lambda/python/2.31.0/#lambda-layer
    const lambdaPowerToolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      "LambdaPowerTools",
      `arn:aws:lambda:${
        cdk.Stack.of(this).region
      }:017000801446:layer:AWSLambdaPowertoolsPythonV2:59`
    );

    /*
     * Creates and initializes DescopeClient with SSM Parameter for Management Key
     */
    const descopeHelperLayer = new PythonLayerVersion(
      this,
      "DescopeHelperLayer",
      {
        entry: path.join(__dirname, "../resources/layers/helper"),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      }
    );

    /*
     * Extension that gives permissions for SSM parameters
     */
    const parametersAndSecretsLambdaExtensionLayerTable = new cdk.CfnMapping(
      this,
      "RegionTable",
      {
        mapping: {
          "us-east-1": {
            layerArn:
              "arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11",
          },
          "us-east-2": {
            layerArn:
              "arn:aws:lambda:us-east-2:590474943231:layer:AWS-Parameters-and-Secrets-Lambda-Extension:14",
          },
          "us-west-2": {
            layerArn:
              "arn:aws:lambda:us-west-2:345057560386:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11",
          },
          "ca-central-1": {
            layerArn:
              "arn:aws:lambda:ca-central-1:200266452380:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11",
          },
        },
      }
    );

    const parametersAndSecretsLambdaExtensionLayer =
      lambda.LayerVersion.fromLayerVersionArn(
        this,
        "ParametersAndSecretsLambdaExtension",
        parametersAndSecretsLambdaExtensionLayerTable.findInMap(
          cdk.Stack.of(this).region,
          "layerArn"
        )
      );

    const lambdaFunctionsLayers = [
      lambdaPowerToolsLayer,
      descopeHelperLayer,
      parametersAndSecretsLambdaExtensionLayer,
    ];

    /*
     * Sets up Client Function for
     */
    this.createClientFunction = new PythonFunction(
      this,
      "createClientFunction",
      {
        entry: path.join(
          __dirname,
          "../../../resources/functions/create-client"
        ),
        runtime: Runtime.PYTHON_3_12,
        index: "index.py",
        handler: "lambda_handler",
        timeout: Duration.seconds(60),
        layers: lambdaFunctionsLayers,
        environment: {
          DESCOPE_PROJECT_ID: props.projectId,
          DESCOPE_MANAGEMENT_KEY: clientSecretSSMMgmtKey.parameterName,
          DESCOPE_BASE_URI: this.defaultDomain,
        },
      }
    );
    clientSecretSSMMgmtKey.grantRead(this.createClientFunction);

    // Set base url based on project id length
    this.defaultDomain = baseUrlForProjectId(props.projectId);

    this.managementBaseUrl = props.domain || this.defaultDomain;
    this.jwtIssuer = `https://${props.domain}/${props.projectId}`;
    this.jwtAudience = [props.projectId];
    this.tokenEndpoint = `https://${props.domain}/oauth2/v1/token`;
    this.wellKnownEndpointUrl = `https://${props.domain}/.well-known/openid-configuration`;

    const machineClientResource = this.createMachineClient(
      this,
      "MachineClient",
      {
        name: "SBT Auto-generated Access Key",
        description:
          "Auto generated Access Key to be used with Client Credentials Flow",
      }
    );

    this.machineClientId = machineClientResource.getAttString("ClientId");
    new cdk.CfnOutput(this, "machineClientId", { value: this.machineClientId });

    this.machineClientSecret = cdk.SecretValue.resourceAttribute(
      machineClientResource.getAttString("ClientSecret")
    );

    // Default SSO application is the only user client that's currently supported.
    this.userClientId = props.projectId;
    new cdk.CfnOutput(this, "userClientId", { value: this.userClientId });

    // Lambda function for user management services
    const userManagementServices = new PythonFunction(
      this,
      "userManagementServices",
      {
        entry: path.join(
          __dirname,
          "../../../resources/functions/user-management"
        ),
        runtime: Runtime.PYTHON_3_12,
        index: "index.py",
        handler: "lambda_handler",
        timeout: Duration.seconds(60),
        layers: lambdaFunctionsLayers,
        environment: {
          DESCOPE_PROJECT_ID: props.projectId,
          DESCOPE_MANAGEMENT_KEY: clientSecretSSMMgmtKey.parameterName,
          DESCOPE_BASE_URI: this.defaultDomain,
        },
      }
    );
    clientSecretSSMMgmtKey.grantRead(userManagementServices);

    this.createAdminUserFunction = new PythonFunction(
      this,
      "CreateAdminUserFunction",
      {
        entry: path.join(
          __dirname,
          "../../../resources/functions/create-admin"
        ),
        runtime: Runtime.PYTHON_3_12,
        index: "index.py",
        handler: "handler",
        timeout: Duration.seconds(60),
        layers: lambdaFunctionsLayers,
      }
    );

    NagSuppressions.addResourceSuppressions(
      [
        this.createClientFunction.role!,
        // TODO: Figure out which privileges in AWS make sense to use for User Management
        userManagementServices.role!,
        this.createAdminUserFunction.role!,
      ],
      [
        {
          id: "AWSSolutions-IAM4",
          reason: "Supress usage of AWSLambdaBasicExecution role.",
          appliesTo: [
            "Policy::arn::<AWS::Partition>:iam:aws:policy/service-role/AWSLambdaBasicExecutionRole",
          ],
        },
      ]
    );
  }
  // Create Admin User Function
  createMachineClient(
    scope: Construct,
    id: string,
    props: CreateMachineClientProps
  ): cdk.CustomResource {
    return new cdk.CustomResource(scope, `createClientCustomResource-${id}`, {
      serviceToken: this.createAdminUserFunction.functionArn,
      properties: {
        Name: props.name ? props.name : id,
        ...(props.description && { Description: props.description }),
      },
    });
  }
  createAdminUser(scope: Construct, id: string) {
    new CustomResource(scope, `createAdminUserCustomResource-${id}`, {
      serviceToken: this.createAdminUserFunction.functionArn,
      properties: {
        Name: "Dummy Name",
        Email: "Dummy Email",
        DisplayName: "Dummy Display Name",
      },
    });
  }
}
