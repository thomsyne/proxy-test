const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');

function createCloudFrontDistribution(stack, id, domainNames, certificate, originUrl, originRequestPolicy, edgeLambdas, extra={}) {
  return new cloudfront.Distribution(stack, id, {
    domainNames,
    certificate,
    defaultBehavior: {
      origin: new origins.HttpOrigin(originUrl, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY
      }),
      compress: true,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy,
      edgeLambdas
    },
    ...extra
  });
}

module.exports = { createCloudFrontDistribution };
