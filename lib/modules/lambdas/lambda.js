const lambda = require('aws-cdk-lib/aws-lambda');
const cdk = require('aws-cdk-lib');

function createLambdaFunction(stack, id, functionName, codePath, role, timeout, environment = {}, extra={}) {
  return new lambda.Function(stack, id, {
    functionName,
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(codePath),
    role,
    timeout: cdk.Duration.seconds(timeout),
    memorySize: 128,
    environment,
    ...extra
  });
}

module.exports = { createLambdaFunction };
