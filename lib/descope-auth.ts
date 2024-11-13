import {
  PythonFunction,
  PythonLayerVersion,
} from "@aws-cdk/aws-lambda-python-alpha";
import { aws_logs, Duration, CustomResource } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Runtime, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { Provider } from "aws-cdk-lib/custom-resources";
import { CreateAdminUserProps } from "@cdklabs/sbt-aws";
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
  readonly logGroupName: string;

  // Only used in initialization
  private readonly createMachineClientFunction: lambda.IFunction;
  private readonly createAdminUserFunction: lambda.IFunction;

  // For base url for Descope Management SDK
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
        entry: path.resolve(__dirname, "../resources/layers/helper"),
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
     * Sets up Client Function for Creating Machine Client
     */
    this.createMachineClientFunction = new PythonFunction(
      this,
      "CreateClientFunction",
      {
        entry: path.resolve(__dirname, "../resources/functions/create-client"),
        runtime: Runtime.PYTHON_3_12,
        index: "index.py",
        handler: "lambda_handler",
        timeout: Duration.seconds(60),
        layers: [descopeHelperLayer],
        environment: {
          DESCOPE_PROJECT_ID: props.projectId,
          DESCOPE_MANAGEMENT_KEY: clientSecretSSMMgmtKey.parameterName,
        },
      }
    );
    clientSecretSSMMgmtKey.grantRead(this.createMachineClientFunction);

    // Define the custom resource provider
    const provider = new Provider(this, "Provider", {
      onEventHandler: this.createMachineClientFunction,
    });

    // Create the custom resource
    const customResource = new CustomResource(
      this,
      "CreateMachineClientCustomResource",
      {
        serviceToken: provider.serviceToken,
        properties: {
          name: "SBT Access Key",
          description: "Auto-generated Access Key for SBT",
        },
      }
    );

    this.machineClientId = customResource.getAttString("ClientId");
    new cdk.CfnOutput(this, "machineClientId", { value: this.machineClientId });

    this.machineClientSecret = cdk.SecretValue.resourceAttribute(
      customResource.getAttString("ClientSecret")
    );

    // Ensure the domain is valid or fallback to a generated default domain
    const validateDomain = (domain: string | undefined): string => {
      if (domain && domain.startsWith("https://") && !domain.endsWith("/")) {
        return domain;
      }
      return baseUrlForProjectId(props.projectId);
    };

    this.defaultDomain = validateDomain(props.domain);

    this.managementBaseUrl = this.defaultDomain;
    this.jwtIssuer = `https://${this.defaultDomain}/${props.projectId}`;
    this.jwtAudience = [props.projectId];
    this.tokenEndpoint = `https://${this.defaultDomain}/oauth2/v1/token`;
    this.wellKnownEndpointUrl = `https://${this.defaultDomain}/.well-known/openid-configuration`;

    // Default SSO application is the only user client that's currently supported.
    this.userClientId = props.projectId;
    new cdk.CfnOutput(this, "userClientId", { value: this.userClientId });

    // Lambda function for user management services
    const userManagementServices = new PythonFunction(
      this,
      "userManagementServices",
      {
        entry: path.join(__dirname, "../resources/functions/user-management"),
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

    // Define user operation Lambda functions
    this.createUserFunction = userManagementServices;
    this.fetchAllUsersFunction = userManagementServices;
    this.fetchUserFunction = userManagementServices;
    this.updateUserFunction = userManagementServices;
    this.deleteUserFunction = userManagementServices;
    this.disableUserFunction = userManagementServices;
    this.enableUserFunction = userManagementServices;

    NagSuppressions.addResourceSuppressions(
      [this.createMachineClientFunction.role!, userManagementServices.role!],
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

    this.createAdminUserFunction = new PythonFunction(
      this,
      "CreateAdminUserFunction",
      {
        entry: path.resolve(__dirname, "../resources/functions/create-admin"),
        runtime: Runtime.PYTHON_3_12,
        index: "index.py",
        handler: "handler",
        timeout: Duration.seconds(5), // Short timeout for minimal impact
        layers: lambdaFunctionsLayers,
        environment: {
          DESCOPE_PROJECT_ID: props.projectId,
        },
      }
    );
  }
  createAdminUser(
    scope: Construct,
    id: string,
    props: CreateAdminUserProps
  ): void {
    new CustomResource(scope, `createAdminUserCustomResource-${id}`, {
      serviceToken: this.createAdminUserFunction.functionArn,
      properties: {
        Name: props.name,
        Email: props.email,
        Role: props.role,
      },
    });
  }
}
