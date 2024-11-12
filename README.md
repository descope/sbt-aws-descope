# Descope Authentication for AWS SaaS Builder Toolkit (SBT)

This module integrates Descope as the authentication provider within the AWS SaaS Builder Toolkit (SBT), enabling seamless user authentication in SaaS applications. Descope’s features, such as passwordless authentication, MFA, and SSO, are seamlessly available to SaaS tenants and users, enhancing security while simplifying identity management.

For more information on SaaS best practices, see the [AWS SaaS Builder Toolkit (SBT)](https://github.com/awslabs/sbt-aws), which provides reusable components for tenant management, billing, and onboarding, reducing boilerplate code and promoting reusable implementations.

### What is Descope?

[Descope](https://docs.descope.com/) is a passwordless authentication and user management service designed for B2B and B2C applications. With no-code workflows and an SDK, Descope allows easy creation of secure authentication flows, supporting methods like passkeys, magic links, social logins, and MFA, all while preventing credential-based attacks.

![Descope Logo](images/descopelogo.png)

Descope offers:
- **Passwordless Authentication**: Improve UX with passkeys, magic links, social logins, and more.
- **Multi-Factor Authentication (MFA)**: Enforce risk-based MFA and step-up controls.
- **Single Sign-On (SSO)**: Support both IdP and SP-initiated SSO via SAML or OIDC.
- **Fraud Prevention**: Protect against bots and login fraud using third-party connectors.
- **Identity Federation**: Centralize identity management across internal and customer-facing apps.

### How Descope Integrates with SBT

This plugin’s `DescopeAuth` construct implements the [`IAuth`](https://github.com/awslabs/sbt-aws/blob/main/API.md#iauth-) interface, allowing users to use Descope as the main authentication provider in their SBT-based applications.

**Features include:**
- Programmatic user management for tenants
- Machine-to-Machine (M2M) authentication using Descope tokens and client credentials

The `DescopeAuth` construct deploys an AWS Lambda function for authentication-related operations.

#### Key Functions

- **Admin User Creation**: Creates an admin user in Descope for each tenant.
- **Client Credentials**: Enables M2M authentication via Descope tokens, leveraging client credentials.

## Prerequisites

1. **Deploy an SBT Project**: Start with the [AWS SBT tutorial](https://github.com/awslabs/sbt-aws/tree/main/docs/public) to deploy a sample `hello-cdk` project with a `ControlPlane` and `CoreApplicationPlane`.
2. **Descope Account**: Sign up for a [Descope Account](https://www.descope.com/sign-up), which will automatically create a [Descope Project]() for you, retrieve the Management Key from your [Company Settings](https://app.descope.com/settings/company/managementkeys).
3. **Management Key Secret**: Store the Descope Management Key as a secret in AWS Secrets Manager.

    - **Secret Name**: Specify the secret name in AWS Secrets Manager.
    - **Secret KeyId**: Specify the key in the secret JSON for the Descope Management Key.

## How to Use

### 1. Install the NPM Package

In your SBT project directory, install the Descope authentication package:

```shell
npm install --save sbt-aws-descope
```

### 2. Add DescopeAuth to Your Control Plane

Add the `DescopeAuth` construct to your AWS CDK stack. Here’s an example setup:

```typescript
import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sbt from '@cdklabs/sbt-aws';
import { DescopeAuth } from 'sbt-aws-descope';

export class ControlPlaneStack extends Stack {
  constructor(scope: Construct, id: string, props: any) {
    super(scope, id, props);

    const descopeAuth = new sbt.DescopeAuth(this, 'DescopeAuth', {
        idpName: 'Descope',
        descopeProjectId: '<<Your Descope Project ID>>',
        descopeManagementAPIKey: '<<Your Descope Management API Key>>',
        systemAdminEmail: '<<Your Admin Email>>',
        setAPIGWScopes: false,
      });
  
    const controlPlane = new sbt.ControlPlane(this, 'ControlPlane', {
      auth: descopeAuth,
    });
  }
}
```

### DescopeAuth Properties

| Property Name            | Type   | Required | Description                                                     | Default Value            |
|--------------------------|--------|----------|-----------------------------------------------------------------|--------------------------|
| `descopeProjectId`       | string | Yes      | Your Descope project ID.                                        |                          |
| `clientSecretSSMMgmtKey` | string | Yes      | AWS Secrets Manager key for Descope's Management API Key.       |                          |
| `descopeDomain`          | string | Optional | Base URL for Descope’s API.                                     | `https://api.descope.com`|

### Creating an Admin User

Use the `createAdminUser` function to manage the creation of an admin user via Descope:

```typescript
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
```

### Creating Clients for M2M Authentication

This function enables M2M authentication by generating tokens for service-to-service communication.

```typescript
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
```

## Limitations

`DescopeAuth` is in preview. Development is ongoing, and limitations may exist.

## Useful Commands

- `npm run build`: Compile TypeScript to JavaScript.
- `npm run watch`: Watch for changes and compile automatically.
- `npm run test`: Run unit tests using Jest.