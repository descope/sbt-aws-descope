import * as cdk from 'aws-cdk-lib';
import { CfnRule, EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AwsSolutionsChecks } from 'cdk-nag';
import * as sbt from '.';

export interface IntegStackProps extends cdk.StackProps {
  systemAdminEmail: string;
}

export class IntegStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: IntegStackProps) {
    super(scope, id, props);

    const descopeAuth = new DescopeAuth(this, 'DescopeAuth', {
      setAPIGWScopes: true // only for testing purposes!
    });

    const controlPlane = new sbt.ControlPlane(this, 'ControlPlane', {
      auth: descopeAuth,
      systemAdminEmail: props.systemAdminEmail
    });
  }
}