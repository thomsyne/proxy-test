const route53 = require("aws-cdk-lib/aws-route53");

function createHostedZone(stack, id, hostedZoneId, domainName, extra = {}) {
  return route53.HostedZone.fromHostedZoneAttributes(stack, id , {
    hostedZoneId,
    zoneName: domainName.replace(/^www\./, ""),
    ...extra,
  });
}

module.exports = { createHostedZone };
