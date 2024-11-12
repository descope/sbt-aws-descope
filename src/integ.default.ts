import * as cdk from "aws-cdk-lib";
import * as sbt from "@cdklabs/sbt-aws";
import { DescopeAuth } from "./DescopeAuth";

export interface IntegStackProps extends cdk.StackProps {
  systemAdminEmail: string;
}

export class IntegStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: IntegStackProps) {
    super(scope, id, props);

    const descopeAuth = new DescopeAuth(this, "DescopeAuth", {
      projectId: "<<Descope Project ID>>",
      clientSecretSSMMgmtKey: "<<Descope Management Key>>",
      setAPIGWScopes: true,
    });

    // const controlPlane = new sbt.ControlPlane(this, "ControlPlane", {
    //   auth: descopeAuth,
    //   systemAdminEmail: props.systemAdminEmail,
    // });
  }
}
