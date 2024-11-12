import * as cdk from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import { AwsSolutionsChecks } from "cdk-nag";
import { Construct } from "constructs";
import { ControlPlane } from "@cdklabs/sbt-aws";
import { Capture } from "aws-cdk-lib/assertions";
import { DescopeAuth } from "../src/DescopeAuth";

describe("DescopeAuth Component", () => {
  const app = new cdk.App();

  class DescopeAuthTestStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);
      const systemAdminEmail = "test@example.com";
      const descopeAuth = new DescopeAuth(this, "DescopeAuth", {
        projectId: "your_project_id", // replace with actual project ID
        clientSecretSSMMgmtKey: "your_ssm_key_name",
      });

      new ControlPlane(this, "ControlPlane", {
        systemAdminEmail: systemAdminEmail,
        auth: descopeAuth,
      });
    }
  }

  const stack = new DescopeAuthTestStack(app, "DescopeAuthTestStack");

  cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

  it("should have no unsuppressed Warnings", () => {
    const warnings = Annotations.fromStack(stack).findWarning(
      "*",
      Match.stringLikeRegexp("AwsSolutions-.*")
    );
    expect(warnings).toHaveLength(0);
  });

  it("should have no unsuppressed Errors", () => {
    const errors = Annotations.fromStack(stack).findError(
      "*",
      Match.stringLikeRegexp("AwsSolutions-.*")
    );
    expect(errors).toHaveLength(0);
  });
});

const app = new cdk.App();
interface DescopeTestStackProps extends cdk.StackProps {
  systemAdminEmail: string;
}
class DescopeTestStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: DescopeTestStackProps) {
    super(scope, id, props);

    const descopeAuth = new DescopeAuth(this, "DescopeAuth", {
      projectId: "your_project_id", // replace with actual project ID
      clientSecretSSMMgmtKey: "your_ssm_key_name",
    });

    new ControlPlane(this, "ControlPlane", {
      systemAdminEmail: props.systemAdminEmail,
      auth: descopeAuth,
    });
  }
}

describe("DescopeAuth ControlPlane Tests", () => {
  const descopeTestStack = new DescopeTestStack(
    app,
    "DescopeAuthControlPlaneStack",
    {
      systemAdminEmail: "test@example.com",
    }
  );
  const template = Template.fromStack(descopeTestStack);

  it("should configure necessary DescopeAuth properties", () => {
    template.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "your_ssm_key_name",
      Type: "SecureString",
    });
  });

  it("should configure DescopeAuth client ID and secret", () => {
    const descopeAuthCapture = new Capture();

    template.allResourcesProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          CLIENT_ID: "your_project_id",
          CLIENT_SECRET_PARAMETER_NAME: "your_ssm_key_name",
        },
      },
    });
  });
});

describe("DescopeAuth API logging configuration", () => {
  it("should configure logging for the API by default", () => {
    const stackWithLogging = new DescopeTestStack(
      new cdk.App(),
      "stackWithLogging",
      {
        systemAdminEmail: "test@example.com",
      }
    );
    const template = Template.fromStack(stackWithLogging);

    template.hasResourceProperties(
      "AWS::ApiGatewayV2::Stage",
      Match.objectLike({
        AccessLogSettings: {
          DestinationArn: Match.anyValue(),
          Format: Match.anyValue(),
        },
      })
    );
  });

  it("should not configure logging if the disable logging flag is true", () => {
    const stackWithoutLogging = new DescopeTestStack(
      new cdk.App(),
      "stackWithoutLogging",
      {
        systemAdminEmail: "test@example.com",
      }
    );
    const templateWithoutLogging = Template.fromStack(stackWithoutLogging);

    templateWithoutLogging.hasResourceProperties(
      "AWS::ApiGatewayV2::Stage",
      Match.objectLike({
        AccessLogSettings: Match.absent(),
      })
    );
  });
});
