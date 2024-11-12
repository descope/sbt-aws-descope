### Overview

This module extends the AWS SaaS Builder ToolKit (SBT) by integrating Descope as the main authentication provider, enabling seamless user authentication of your customers. With this integration, you can effortlessly implement an SBT plugin using Descope. modern, usage-based billing for your SaaS and GenAI applications out-of-the-box.

Sign up for your [free Descope Account](https://www.descope.com/sign-up) to start using the auth SBT plugin.

[AWS SaaS Builder Toolkit (SBT)](https://github.com/awslabs/sbt-aws) is an open-source developer toolkit to implement SaaS best practices. SBT attempts to codify several control plane and application plane concepts such as tenant and user management, billing, and onboarding into reusable components, promoting reuse and reducing boilerplate code.


This repository provides a detailed implementation of the Descope authentication service for use with the AWS SaaS Factory Software Builder Toolkit (SBT). The implementation enables users to build SaaS app using Descope as the main authentication provider with all of user's resources deployed on AWS. 


### What is Descope

[Descope](https://docs.descope.com/) is a passwordless authentication and user management service designed for developers. With our SDKs and no-code workflow builder, you can easily create and customize secure authentication flows for every interaction a user has with your B2B or B2C application.

With Descope you can simplify the implementation of secure authentication and identity management for developers and businesses, allowing them to focus on their core product features while ensuring robust security for their users. It makes it very easy to enable a variety of different user authentication methods in your application. Descope also helps in preventing attackers from breaking authentication through session theft, credential stuffing, brute force, and other exploit methods.

<p align="center">
  <img src="images/descopelogo.png" alt="Descope" style="max-width: 100%; height: auto;">
</p>

With Descope, you can:
- Passwordless authentication: Improve UX and nip password-based attacks in the bud. Choose from passkeys, magic links. social logins and more
- MFA: Easily add risk-based MFA and step-up controls to your user journeys
- Single Sign-On: Easily implement both IdP and SP initiated SSO with both SAML and OIDC support
- Fraud Prevention: Stop bots and login fraud with third-party connectors such as reCAPTCHA and Traceable
- Identity Federation: Unify customer identities across all your business-facing and internal apps

### How does Descope work with SBT?

The Descope auth implementation provided in this repository allows users to integrate Descope with their SBT-based applications. 
This enables users to:
- Manage users programmatically (create/delete)
- Create an M2M (Machine to Machine) authentication service, that uses Descope tokens with Client Credentials flow.

The `DescopeAuth` construct deploys an AWS Lambda function to handle user authentication. 

Another important concept worth pointing out here is the plug-ability of this approach. Notice we're creating an "auth" component, in this case called "DescopeAuth". This component implements the [IAuth](https://github.com/awslabs/sbt-aws/blob/main/API.md#iauth-) interface defined in the SBT core package. Currently AWS has a Cognito implementation of IAuth, but here we can technically implement that interface with Descope or any other identity provider.

Here's a brief overview of how this works:

- **Admin Creation**: `createAdminUserFunction` function creates an admin user in the IdP that’s being integrated, which is Descope in this case.
- **Client Creation**: `createClientFunction` function creates m2m authentication service with a client credentials flow.




## How to Use

### Prerequisites

1. **Deploy a SBT Project**: If you don't already have a SBT project deployed, follow [AWS SBT's tutorial](https://github.com/awslabs/sbt-aws/tree/main/docs/public) to deploy the sample `hello-cdk` project with a `ControlPlane` and `CoreApplicationPlane`.
2. **Descope Account**: You need an Descope account for this project. If you don’t have a Descope account, you can sign up for one here: [Descope Signup](https://www.descope.com/sign-up).
3. **Management Key Secret**: After signing up, the Descope Management Key must be stored as a secret in AWS Secrets Manager.
   
   - Secret Name: The name of the secret in AWS Secrets Manager.
   - Secret KeyId: The key within the secret JSON that identifies Descope's Management Key.


   
### 1. Install the NPM Package

Within your SBT project directory, install `sbt-aws-descope` via the following command:

```shell
npm install --save sbt-aws-descope
```

### 2. Add DescopeAuth to Your Control Plane
Instantiate the DescopeAuth construct in your AWS CDK stack. Here’s an example TypeScript code snippet:

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
        descopeManagementAPIKey: '<<Your Descope Management API Key>>'
        systemAdminEmail: '<<Your Admin Email>>', 
        setAPIGWScopes: false,
      });
  
      const controlPlane = new sbt.ControlPlane(this, 'ControlPlane', {
        auth: descopeAuth,
      });
  }
}
```

#### Descope Properties

| Property Name | Type | Required | Description                                                     | Default Value |
|:-------------|:-----|:---------|:----------------------------------------------------------------|:--------------|
| descopeProjectId | string | Yes      | Project ID of your Descope account.                     |  |
| clientSecretSSMMgmtKey | string | Yes      | The key within the secret that identifies the Descope API Key. |  |
| descopeDomain | string | Optional | The base URL for Descope's API.                                | https://api.descope.com |




### Creating an Admin User

This function manages a user creation/Deletion using Descope's packages. 

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
### Creating Clients

This function creates an M2M (Machine to Machine) authentication service, that uses Descope tokens with Client Credentials flow.
The function takes in Descope's Project ID and Management Key as inputs to give a return response of Access Key ID along with its Client ID.

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
`sbt-aws-descope` is in preview. Development is still ongoing. There are limitations to be aware of.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests



