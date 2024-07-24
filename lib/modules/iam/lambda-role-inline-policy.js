const iam = require('aws-cdk-lib/aws-iam');

function createLambdaRoleWithInlinePolicy(stack, id, policies, urlMappingLambdaInlinePolicy, extra={}) {
    const role = new iam.Role(stack, id, {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('edgelambda.amazonaws.com')
      ),
      inlinePolicies: {
        urlMappingLambdaInlinePolicy: urlMappingLambdaInlinePolicy,
      },
      ...extra
    });
  
    policies.forEach(policy => {
      role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(policy));
    });
  
    return role;
  }

module.exports = { createLambdaRoleWithInlinePolicy };
