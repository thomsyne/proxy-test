const acm = require('aws-cdk-lib/aws-certificatemanager');

function createCertificate(stack, id, domainName, extra = {}) {
  return new acm.Certificate(stack, id, {
    domainName: domainName,
    subjectAlternativeNames: [domainName.replace(/^www\./, '')],
    validation: acm.CertificateValidation.fromDns(),
    ...extra
});
}

module.exports = { createCertificate };
