<img width="1400" alt="Screenshot 2024-11-12 at 11 05 55 AM" src="https://github.com/user-attachments/assets/e1f3e665-9a3c-4e88-8b39-d8cebd8f700e">

# Descope for AWS SaaS Builder Toolkit (SBT)

This module integrates [Descope](https://www.descope.com/) as the authentication provider within the AWS SaaS Builder Toolkit (SBT), enabling seamless user authentication and management in SaaS applications. Descope’s features—such as passwordless authentication, MFA, SSO, machine-to-machine (M2M) authentication, and comprehensive user management—are seamlessly available to SaaS tenants and users, enhancing security while simplifying identity management.

For more information on SaaS best practices, see the [AWS SaaS Builder Toolkit (SBT)](https://github.com/awslabs/sbt-aws), which provides reusable components for tenant management, billing, and onboarding, reducing boilerplate code and promoting reusable implementations.

## Table of Contents

- [What is Descope?](#what-is-descope)
- [How Descope Integrates with SBT](#how-descope-integrates-with-sbt)
  - [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [How to Use](#how-to-use)
  - [1. Install the NPM Package](#1-install-the-npm-package)
  - [2. Add DescopeAuth to Your Control Plane](#2-add-descopeauth-to-your-control-plane)
  - [3. Set Up Machine-to-Machine (M2M) Authentication](#3-set-up-machine-to-machine-m2m-authentication)
  - [4. Implementing Descope in Your SaaS Application](#4-implementing-descope-in-your-saas-application)
  - [5. Utilize User Management Functions](#5-utilize-user-management-functions)
- [DescopeAuth Properties](#descopeauth-properties)
- [Limitations](#limitations)
- [Useful Commands](#useful-commands)

## What is Descope?

[Descope](https://docs.descope.com/) is a passwordless authentication and user management service designed for B2B and B2C applications. With no-code workflows and an SDK, Descope allows easy creation of secure authentication flows, supporting methods like passkeys, magic links, social logins, and MFA, all while preventing credential-based attacks.

Descope offers:

- **Passwordless Authentication**: Improve UX with passkeys, magic links, social logins, and more.
- **Multi-Factor Authentication (MFA)**: Enforce risk-based MFA and step-up controls.
- **Single Sign-On (SSO)**: Support both IdP and SP-initiated SSO via SAML or OIDC.
- **Machine-to-Machine (M2M) Authentication**: Secure service-to-service communication using JWTs.
- **User Management**: Comprehensive APIs for creating, updating, and managing users.
- **Fraud Prevention**: Protect against bots and login fraud using third-party connectors.
- **Identity Federation**: Centralize identity management across internal and customer-facing apps.

## How Descope Integrates with SBT

This plugin’s `DescopeAuth` construct implements the [`IAuth`](https://github.com/awslabs/sbt-aws/blob/main/API.md#iauth-) interface, allowing you to use Descope as the main authentication provider in your SBT-based applications.

### Key Features

- **Programmatic User Management**: Create, update, delete, and manage users programmatically using SBT API routes.
- **Machine-to-Machine (M2M) Authentication**: Enable secure service-to-service communication using Descope JWTs.
- **Session Validation**: Validate user sessions seamlessly using the Descope well-known configuration.
- **Admin User Creation**: Create admin users in Descope for each tenant.
- **Client Credentials**: Generate tokens for M2M authentication via client credentials.

The `DescopeAuth` construct deploys AWS Lambda functions and necessary configurations for authentication-related operations.

## Prerequisites

1. **Deploy an SBT Project**: Start with the [AWS SBT tutorial](https://github.com/awslabs/sbt-aws/tree/main/docs/public) to deploy a sample `hello-cdk` project with a `ControlPlane` and `CoreApplicationPlane`.
2. **Descope Account**: Sign up for a [Descope Account](https://www.descope.com/sign-up), which will automatically create a [Descope Project](https://docs.descope.com/guides/dashboard/projects) for you.
3. **Retrieve Management Key**: Obtain the Descope Management API Key from your [Company Settings](https://app.descope.com/settings/company/managementkeys).
4. **Store Management Key in AWS Secrets Manager**:
   - **Secret Name**: Specify the secret name in AWS Secrets Manager where you store the Descope Management API Key.
   - **Secret Key**: Specify the key in the secret JSON for the Descope Management API Key.

## How to Use

### 1. Install the NPM Package

In your SBT project directory, install the Descope authentication package:

```shell
npm install --save sbt-aws-descope
```

### 2. Add DescopeAuth to Your Control Plane

Add the `DescopeAuth` construct to your AWS CDK stack. Here’s an example setup:

```typescript
import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sbt from "@cdklabs/sbt-aws";
import { DescopeAuth } from "sbt-aws-descope";

export class ControlPlaneStack extends Stack {
  constructor(scope: Construct, id: string, props: any) {
    super(scope, id, props);

    const descopeAuth = new DescopeAuth(this, "DescopeAuth", {
      idpName: "Descope",
      descopeProjectId: "<<Your Descope Project ID>>",
      clientSecretSSMMgmtKey: "<<Your AWS Secrets Manager Secret Name>>",
      descopeDomain: "https://api.descope.com", // Replace this with your own custom domain, if configured in Descope.
      systemAdminEmail: "<<Your Admin Email>>",
      setAPIGWScopes: false,
    });

    const controlPlane = new sbt.ControlPlane(this, "ControlPlane", {
      auth: descopeAuth,
    });
  }
}
```

### 3. Set Up Machine-to-Machine (M2M) Authentication

The DescopeAuth construct enables M2M authentication by generating tokens for service-to-service communication. This allows your microservices or backend processes to authenticate securely using Descope JWTs.

```typescript
// In your ControlPlaneStack or relevant stack
descopeAuth.createM2MClient(this, "M2MClient", {
  clientName: "ServiceA",
  clientDescription: "M2M Client for Service A",
});
```

This will create a client in Descope for M2M authentication and store the client credentials securely.

### 4. Implementing Descope in Your SaaS Application

> **Callout**: You will not be able to configure additional [Applications](https://docs.descope.com/sso-integrations/applications) in Descope through the SBT plugin. You must do that in the [Descope Console](https://app.descope.com/applications) itself.

Once you've setup `DescopeAuth` and SBT, you'll need to actually implement Descope authentication and our SDKs into your SaaS application. We have two primary ways of integrating into an application, either via our web component and client SDKs (for an embedded flow experience), or with our [Auth Hosting](https://docs.descope.com/auth-hosting-app) application and OIDC/SAML.

For setup guides for both, visit our [Quickstart](https://docs.descope.com/getting-started) page on our docs.

In either case, you will recieve a JWT after being authenticated, that you will be able to use with your SBT resources.

### 5. Utilize User Management Functions

> **Optional**: This part is optional, as you may not require user management functions in your backend via APIs if everything is handled with Flows.

The DescopeAuth construct provides comprehensive user management functions that integrate with SBT API routes. You can create, update, delete, and manage users programmatically.

#### Creating an Admin User

To create a new [Descoper](https://docs.descope.com/company-settings#descopers), you must do this within the Descope Console under [Company Settings](https://app.descope.com/settings/company/managementkeys). The SBT plugin does not provide the ability to create additional Descopers in your Descope Company

#### User Management via SBT API Routes

The following user management functions are supported:

- **Create User**
- **Get User**
- **Update User**
- **Delete User**
- **Enable User**
- **Disable User**
- **List Users**

These functions are accessible via the SBT API routes and leverage Descope's user management APIs under the hood.

```typescript
// Example: Creating a user via API route
app.post("/users", async (req, res) => {
  const { userName, email, displayName } = req.body;
  const result = await descopeAuth.createUser(userName, email, displayName);
  res.json(result);
});
```

## DescopeAuth Properties

| Property Name            | Type    | Required | Description                                                       | Default Value             |
| ------------------------ | ------- | -------- | ----------------------------------------------------------------- | ------------------------- |
| `descopeProjectId`       | string  | Yes      | Your Descope Project ID.                                          |                           |
| `clientSecretSSMMgmtKey` | string  | Yes      | AWS Secrets Manager secret name for Descope's Management API Key. |                           |
| `descopeDomain`          | string  | Optional | Base URL for Descope’s API.                                       | `https://api.descope.com` |
| `idpName`                | string  | Optional | Identity Provider name.                                           | `Descope`                 |
| `systemAdminEmail`       | string  | Optional | Email address for the system administrator.                       |                           |
| `setAPIGWScopes`         | boolean | Optional | Whether to set API Gateway scopes.                                | `false`                   |

## Limitations

Development is ongoing with `DescopeAuth`, and limitations may exist. Future updates may include additional features and improvements, such as creation of Descope [Applications](https://docs.descope.com/sso-integrations/applications), and [Tenant Management](https://docs.descope.com/tenant-management) functions.

## Useful Commands

- `npm run build`: Compile TypeScript to JavaScript.
- `npm run watch`: Watch for changes and compile automatically.
- `npm run test`: Run unit tests using Jest.

---

If you have any questions or need assistance, please refer to the [Descope Documentation](https://docs.descope.com/) or the [AWS SBT repository](https://github.com/awslabs/sbt-aws).
