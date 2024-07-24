const s3 = require('aws-cdk-lib/aws-s3');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const cdk = require('aws-cdk-lib');

function createS3Bucket(stack, id, bucketName, extra={}) {
  return new s3.Bucket(stack, id, {
    bucketName,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    ...extra
  });
}

function createOriginAccessIdentity(stack, id, extra={}) {
  return new cloudfront.OriginAccessIdentity(stack, id, {
    comment: "Reverse Proxy Bucket OAI",
    ...extra
  });
}

module.exports = { createS3Bucket, createOriginAccessIdentity };
