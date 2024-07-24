const iam = require('aws-cdk-lib/aws-iam');

function addLambdaPolicy(lambdaFunction, policyStatements) {
    policyStatements.forEach(statement => {
      lambdaFunction.addToRolePolicy(new iam.PolicyStatement(statement));
    });
  }
  
  module.exports = { addLambdaPolicy };