const iam = require('aws-cdk-lib/aws-iam');

function createLambdaRole(stack, id, policies, extra={}) {
  const role = new iam.Role(stack, id, {
    assumedBy: new iam.CompositePrincipal(
      new iam.ServicePrincipal('lambda.amazonaws.com'),
      new iam.ServicePrincipal('edgelambda.amazonaws.com')
    ),
    ...extra
  });

  if (policies.length > 0) {
    policies.forEach(policy => {
      role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(policy));
    });
  }


  return role;
}

module.exports = { createLambdaRole };
