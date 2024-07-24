const iam = require('aws-cdk-lib/aws-iam');

function createLambdaRole(stack, id, policies, inlinePolicy) {
  const role = new iam.Role(stack, id, {
    assumedBy: new iam.CompositePrincipal(
      new iam.ServicePrincipal('lambda.amazonaws.com'),
      new iam.ServicePrincipal('edgelambda.amazonaws.com')
    ),
    inlinePolicies: inlinePolicy
  });

  policies.forEach(policy => {
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(policy));
  });

  return role;
}

function createWebhookLambdaRole(stack, tableArn, bucketArn, queueArn) {
  const role = new iam.Role(stack, 'WebhookLambdaRole', {
    assumedBy: new iam.CompositePrincipal(
      new iam.ServicePrincipal('lambda.amazonaws.com'),
      new iam.ServicePrincipal('edgelambda.amazonaws.com')
    ),
    inlinePolicies: {
      webhookInlinePolicy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ['dynamodb:*'],
            resources: [`${tableArn}*`],
          }),
          new iam.PolicyStatement({
            actions: ['s3:PutObject'],
            resources: [`${bucketArn}*`],
          }),
          new iam.PolicyStatement({
            actions: ['sqs:SendMessage'],
            resources: [`${queueArn}*`],
          }),
        ],
      }),
    },
  });

  role.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  );

  return role;
}

module.exports = { createLambdaRole, createWebhookLambdaRole };
