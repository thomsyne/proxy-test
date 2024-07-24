const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');

function createOriginAccessPolicy(stack, id, originRequestPolicyName, comment, allowList, extra={}) {
  return new cloudfront.OriginRequestPolicy(stack, id, {
    originRequestPolicyName,
    comment,
    cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(...allowList),
    queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    ...extra
});
}

module.exports = { createOriginAccessPolicy };
