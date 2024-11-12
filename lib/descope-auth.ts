// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  PythonFunction,
  PythonLayerVersion,
} from "@aws-cdk/aws-lambda-python-alpha";
import {
  aws_logs as AwsLogs,
  CustomResource,
  Duration,
  SecretValue,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Runtime, IFunction, LayerVersion } from "aws-cdk-lib/aws-lambda";
import * as sbt from "@cdklabs/sbt-aws";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { addTemplateTag } from "../../utils";
import { NagSuppressions } from "cdk-nag";

/**
 * Properties for the DescopeAuth construct.
 */
export interface DescopeAuthProps {
  /**
   * Descope Project ID.
   * This is to make calls to Descope Management APIs.
   */
  readonly descopeProjectId: string;

  /**
   * Override the base URL for the well-known configuration.
   * @default defaultDescopeDomain
   */
  readonly descopeDomain?: string;

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

export interface CreateUserClientProps {
  readonly name?: string;
  readonly description?: string;
  readonly callbacks?: string[];
}

export class DescopeAuth extends Construct implements sbt.IAuth {
  readonly jwtIssuer: string;
  readonly jwtAudience: string[];
  readonly managementBaseUrl: string;
  readonly tokenEndpoint: string;
  readonly userClientId: string;
  readonly machineClientId: string;
  readonly machineClientSecret: string;
  readonly wellKnownEndpointUrl: string;
  readonly createUserFunction: IFunction;
  readonly fetchAllUsersFunction: IFunction;
  readonly fetchUserFunction: IFunction;
  readonly updateUserFunction: IFunction;
  readonly deleteUserFunction: IFunction;
  readonly disableUserFunction: IFunction;
  readonly enableUserFunction: IFunction;
  readonly logGroupName: string;

  private readonly createAdminUserFunction: IFunction;
  private readonly createClientFunction: IFunction;
  private readonly defaultDescopeDomain: string;

  constructor(scope: Construct, id: string, props: DescopeAuthProps) {
    super(scope, id);
    addTemplateTag(this, "DescopeAuth");

    // Set default domain if descopeProjectId has correct length
    this.defaultDescopeDomain =
      props.descopeProjectId && props.descopeProjectId.length === 32
        ? "https://api.euc1.descope.com"
        : "https://api.descope.com";

    this.managementBaseUrl = props.descopeDomain || this.defaultDescopeDomain;
    this.jwtIssuer = `https://${props.descopeDomain}/${props.descopeProjectId}`;
    this.tokenEndpoint = `https://${props.descopeDomain}/oauth2/v1/token`;
    this.wellKnownEndpointUrl = `https://${props.descopeDomain}/.well-known/openid-configuration`;

    // SSM parameter for client secret management key
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

    // Create helper which help access the Descope Library
    const descopeHelperLayer = new PythonLayerVersion(
      this,
      "DescopeHelperLayer",
      {
        entry: path.join(__dirname, "../resources/functions/helper"),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      }
    );

    // using extension that allows to read ssm parameters
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
        layers: [lambdaPowerToolsLayer],
        environment: {
          DOMAIN: props.descopeDomain,
          CLIENT_ID: props.descopeProjectId,
          CLIENT_SECRET_PARAMETER_NAME: clientSecretSSMMgmtKey.parameterName,
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

    this.createUserFunction = userManagementServices;

    NagSuppressions.addResourceSuppressions(
      [
        this.createClientFunction.role!,
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
    props: sbt.CreateAdminUserProps
  ): void {
    new cdk.CustomResource(scope, id, {
      serviceToken: this.createAdminUserFunction.functionArn,
      properties: {
        Email: props.email,
        role: props.role,
        Name: props.name,
      },
    });
  }
  createAdminUser(
    scope: Construct,
    id: string,
    props: cdk.CreateAdminUserProps
  ) {
    new CustomResource(scope, `createAdminUserCustomResource-${id}`, {
      serviceToken: this.createAdminUserFunction.functionArn,
      properties: {
        Name: props.name,
        Email: props.email,
        DisplayName: props.display_name,
      },
    });
  }
}
