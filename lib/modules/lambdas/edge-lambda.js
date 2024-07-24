const lambda = require('aws-cdk-lib/aws-lambda');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');

function createEdgeFunction(stack, id, functionName, codePath, role, description, extra={}) {
  return new cloudfront.experimental.EdgeFunction(stack, id, {
    functionName,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(codePath),
    role,
    description,
    ...extra
  });
}

module.exports = { createEdgeFunction };
