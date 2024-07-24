const cdk = require('aws-cdk-lib');
const route53 = require('aws-cdk-lib/aws-route53');
const route53targets = require('aws-cdk-lib/aws-route53-targets');

function createARecord(stack, id, zone, cloudfront, recordName, extra={}) {
  return new route53.ARecord(stack, id, {
    zone,
    target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(cloudfront)),
    recordName,
    ttl: cdk.Duration.minutes(5),
    ...extra
})
}

module.exports = { createARecord };
