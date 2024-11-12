// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PythonFunction , PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import { aws_logs as AwsLogs, Stack, SecretValue } from 'aws-cdk-lib';
import { CustomResource} from 'aws-cdk-lib';
import { CreateAdminUserProps, IAuth } from './auth-interface';
import { Runtime, IFunction, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { DescopeAuth } from 'sbt-aws-descope';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { aws_logs, Duration } from 'aws-cdk-lib';
import * as sbt from '@cdklabs/sbt-aws';
import * as path from 'path';
import { addTemplateTag } from '../../utils';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';



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
     * Override the base URL for the Descope Management API. For most setups, you don't need to set this.
     * @default defaultDescopeDomain
     */ 
    readonly descopeDomain?: string

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

readonly userClientProtocol: string;

  }


export interface CreateUserClientProps {
    readonly name?: string;
    readonly description?: string;
    readonly callbacks?: string[];
    readonly protocol?: UserClientProtocol;
   
}

export enum ClientGrantType {

    CLIENT_CREDENTIALS = 'client_credentials',
    IMPLICIT = 'implicit',
    AUTHORIZATION_CODE = 'authorization_code'

}

export enum UserClientProtocol {

    CLIENT_SAML = 'saml',
    CLIENT_OIDC = 'oidc'

}



export class DescopeAuth extends Construct implements sbt.IAuth{
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
readonly defaultDescopeDomain: string;

  /**
   * The Lambda function for creating a new Admin User. This is used as part of a
   * custom resource in CloudFormation to create an admin user.
   */
  private readonly createAdminUserFunction: IFunction;
  private readonly createClientFunction: IFunction;

constructor(scope: Construct, id: string, props: DescopeAuthProps) {
    super(scope, id);
    addTemplateTag(this, 'DescopeAuth');


    const clientSecretSSMMgmtKey = ssm.StringParameter.fromSecureStringParameterAttributes(
        this, 'clientSecretSSMParameterName',
        { parameterName: props.clientSecretSSMMgmtKey},
    );

    // https://docs.powertools.aws.dev/lambda/python/2.31.0/#lambda-layer
    const lambdaPowerToolsLayer = LayerVersion.fromLayerVersionArn(
        this, 'LambdaPowerTools', `arn:aws:lambda:${cdk.Stack.of(this).region}:017000801446:layer:AWSLambdaPowertoolsPythonV2:59`,
    ); 

// create helper which help access the Descope Library
    const descopeHelperLayer = new PythonLayerVersion(this, 'DescopeHelperLayer', {
        entry: path.join(__dirname, '../resources/functions/helper'),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
    });

// using extension that allows to read ssm parameters
    const parametersAndSecretsLambdaExtensionLayerTable = new cdk.CfnMapping(this, 'RegionTable', {

        mapping: {
            'us-east-1' : {
                layerArn: 'arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11',
            },
            'us-east-2' : {
                layerArn: 'arn:aws:lambda:us-east-2:590474943231:layer:AWS-Parameters-and-Secrets-Lambda-Extension:14',
            },
            'us-west-2' : {
                layerArn: 'arn:aws:lambda:us-west-2:345057560386:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11',
            },
            'ca-central-1' : {
                layerArn: 'arn:aws:lambda:ca-central-1:200266452380:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11',
            },
        },

    });

    const parametersAndSecretsLambdaExtensionLayer = lambda.LayerVersion.fromLayerVersionArn(
        this, 'ParametersAndSecretsLambdaExtension',
        parametersAndSecretsLambdaExtensionLayerTable.findInMap(cdk.Stack.of(this).region, 'layerArn'),
    );

    const lambdaFunctionsLayers = [lambdaPowerToolsLayer, descopeHelperLayer, parametersAndSecretsLambdaExtensionLayer];

    if (props.descopeProjectId && props.descopeProjectId.length === 32) {
        this.defaultDescopeDomain = 'https://api.euc1.descope.com';
    } else {
        this.defaultDescopeDomain = 'https://api.descope.com'; // Default fallback
    }
 
    this.managementBaseUrl = props.descopeDomain || this.defaultDescopeDomain;
    this.jwtIssuer = `https://${props.descopeDomain}/${props.descopeProjectId}`;
    this.jwtAudience = [this.machineClientId];
    this.tokenEndpoint = `https://${props.descopeDomain}/oauth2/v1/token`;
    this.wellKnownEndpointUrl = `https://${props.descopeDomain}/.well-known/openid-configuration`;

// Lambda function for user management services
const userManagementServices = new PythonFunction(this, 'userManagementServices', {
    entry: path.join(__dirname, '../../../resources/functions/user-management'),
    runtime: Runtime.PYTHON_3_12,
    index: 'index.py',
    handler: 'lambda_handler',
    timeout: Duration.seconds(60),
    layers: [lambdaPowerToolsLayer],
    environment: {
        DOMAIN: props.descopeDomain,
        CLIENT_ID: props.descopeProjectId,
        CLIENT_SECRET_PARAMETER_NAME: props.clientSecretSSMMgmtKey
    }
  });


//Creating Admin User Function

this.createAdminUserFunction = new PythonFunction(this, 'createAdminUserFunction', {
    entry: path.join(__dirname, '../../../resources/functions/auth-custom-resource'),
    runtime: Runtime.PYTHON_3_12,
    index: 'index.py',
    handler: 'handler',
    timeout: Duration.seconds(60),
    layers: [lambdaPowerToolsLayer],
  });

// Grant access to the ssm parameter Management Key
 clientSecretSSMMgmtKey.grantRead(this.createAdminUserFunction);


  // Creating Client i.e., Creating access keys in Descope for M2M

  this.createClientFunction = new PythonFunction(this, 'createClientFunction', {
    entry: path.join(__dirname, '../../../resources/functions/create-client'),
    runtime: Runtime.PYTHON_3_12,
    index: 'index.py',
    handler: 'handler',
    timeout: cdk.Duration.seconds(60),
    layers: [lambdaPowerToolsLayer],
    environment: {
        CLIENT_ID: props.descopeProjectId,
        CLIENT_MGMT_KEY: props.clientSecretSSMMgmtKey,
    },
  });

  // Grant access to the ssm parameter Management Key
  clientSecretSSMMgmtKey.grantRead(this.createClientFunction);

  // Creating CustomResource which uses CreateClientFunction and captures the outputs  
  const createClientResource = new CustomResource(this, 'CreateClientResource', {
    serviceToken: this.createClientFunction.functionArn,
    properties: {
    }
  });

  this.machineClientId = createClientResource.getAtt('ClientId').toString();
  this.machineClientSecret = createClientResource.getAtt('AccessKeyId').toString();

 /**
         * Creates the Descope Lambda function.
         * The function is configured with the necessary environment variables, 
         */

const descopeAuth: lambda.IFunction = new lambda.Function(this, '-Management', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'descope.handler',
            tracing: lambda.Tracing.ACTIVE,
            timeout: Duration.seconds(60),
            logGroup: new aws_logs.LogGroup(this, this.logGroupName, {
                retention: aws_logs.RetentionDays.FIVE_DAYS,
            }),
            code: lambda.Code.fromAsset(path.resolve(__dirname, '../../resources/functions')), // Path to the directory containing your Lambda function code
            layers: [
                lambda.LayerVersion.fromLayerVersionArn(this, 'LambdaPowerTools', lambdaPowerToolsLayer)
            ],
            environment: {
                DESCOPE_MANAGEMENT_API_KEY: props.clientSecretSSMMgmtKey,
                DESCOPE_MANAGEMENT_BASE_URL: this.managementBaseUrl,
                
            },
        });

    const defaultControlPlaneCallbackURL = 'http://localhost';
    const controlPlaneCallbackURL = props?.controlPlaneCallbackURL || defaultControlPlaneCallbackURL;

    // Creating OIDC App in Descope supporting auth_code flow
  // const userClientResource = this.createUserClient(this, 'UserClient', {
     //  protocol: props.userClientProtocol
 //  });
}
   createAdminUser(scope: Construct, id: string, props: CreateAdminUserProps) {
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
  





