import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DescopeAuth } from "../lib/descope-auth";

test("Descope Auth Lambdas Created", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "descope-test-stack");

  new DescopeAuth(stack, "DescopeAuth", {
    projectId: "<<Your Descope Project ID>>",
    clientSecretSSMMgmtKey:
      "<<Your SSM Parameter Name for Descope Management Key>>",
    domain: "https://example.com",
  });

  const template = Template.fromStack(stack);

  // Assertions for Lambda Functions
  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.handler",
    Runtime: "python3.12",
  });

  // Verify the custom resource is created if needed
  template.resourceCountIs("AWS::CloudFormation::CustomResource", 1);
});
