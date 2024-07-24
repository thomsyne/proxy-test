const cdk = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const acm = require('aws-cdk-lib/aws-certificatemanager');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');
const sqs = require("aws-cdk-lib/aws-sqs");
const lambdaEventSources = require("aws-cdk-lib/aws-lambda-event-sources");
const route53 = require('aws-cdk-lib/aws-route53');
const route53targets = require('aws-cdk-lib/aws-route53-targets');

const { createCertificate } = require('./modules/certificate');
const { createS3Bucket, createOriginAccessIdentity } = require('./modules/s3-bucket');
const { createDynamoDBTable } = require('./modules/dynamodb-table');

const { createLambdaRole } = require('./modules/iam/lambda-role');
const { createWebhookLambdaRole } = require('./modules/iam/lambda-webhook-role');
const { createLambdaRoleWithInlinePolicy } = require('./modules/iam/lambda-role-inline-policy');
const { addLambdaPolicy } = require('./modules/iam/add-lambda-policy');

const { createEdgeFunction } = require('./modules/lambdas/edge-lambda');
const { createLambdaFunction } = require('./modules/lambdas/lambda');
const { createCloudFrontDistribution } = require('./modules/cloudfront/cloudfront-distribution');
const { createOriginAccessPolicy } = require('./modules/cloudfront/origin-access-policy');
const { createHostedZone } = require('./modules/route53/hosted-zone');
const { createARecord } = require('./modules/route53/record');
const path = require('path');

class ReverseProxyStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const appname = `${process.env.NAME}-proxy-${process.env.ENV}`;
        const webflowURL = `${process.env.WEBFLOWDOMAIN}`;


        const domainName = `${process.env.NEWSITEDOMAIN}`;
        const certificate = createCertificate(this, 'ProxyCertificate', domainName);


        let bucketName = `twb-site-proxy-${process.env.ENV}`
        const reverseProxyBucket = createS3Bucket(this, 'ReverseProxyBucket', bucketName);
        const reverseProxyOAI = createOriginAccessIdentity(this, 'ReverseProxyOAI');
        reverseProxyBucket.grantRead(reverseProxyOAI);


        let tableName = `twb-site-proxy-mapping-${process.env.ENV}`
        const reverseProxyMappingTable = createDynamoDBTable(this, 'ReverseProxyMappingTable', tableName);


        let defaultPolicies = ["AmazonDynamoDBReadOnlyAccess", "service-role/AWSLambdaBasicExecutionRole"]

        const viewerRequestLambdaRole = createLambdaRole(this, 'ViewerRequestLambdaRole', defaultPolicies);
        const viewerResponseLambdaRole = createLambdaRole(this, 'ViewerResponseLambdaRole', defaultPolicies);
        const originRequestLambdaRole = createLambdaRole(this, 'OriginRequestLambdaRole', defaultPolicies);
        const originResponseLambdaRole = createLambdaRole(this, 'OriginResponseLambdaRole', defaultPolicies);
        const localelesslambdaRole = createLambdaRole(this, 'LambdaRole', defaultPolicies);

        const viewerRequestLambda = createEdgeFunction(this, 'viewerRequestLambda', `twb-site-viewer-request-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/viewer-request-lambda/handler/deploy.zip'), viewerRequestLambdaRole);
        const originRequestLambda = createEdgeFunction(this, 'originRequestLambda', `twb-site-origin-request-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/origin-request-lambda/handler/deploy.zip'), originRequestLambdaRole);
        const originResponseLambda = createEdgeFunction(this, 'originResponseLambda', `twb-site-origin-response-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/origin-response-lambda/handler/deploy.zip'), originResponseLambdaRole);
        const viewerResponseLambda = createEdgeFunction(this, 'viewerResponseLambda', `twb-site-viewer-response-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/viewer-response-lambda/handler/deploy.zip'), viewerResponseLambdaRole);
        const localeLessRedirectionLambda = createEdgeFunction(this, 'localeLessRedirectionLambda', `twb-site-locale-less-redirection-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/locale-less-redirection-lambda/handler/deploy.zip'), localelesslambdaRole, new Date().toJSON());


        const cacheInvalidationQueue = new sqs.Queue(this, 'cacheInvalidationQueue', {
            queueName: `twb-site-cache-invalidation-queue-${process.env.ENV}`,
            visibilityTimeout: cdk.Duration.seconds(600),
        });
        const cacheInvalidationQueueUrl = cacheInvalidationQueue.queueUrl;


        const webhooklambdaRole = createWebhookLambdaRole(this, 'WebhookLambdaRole', reverseProxyMappingTable.tableArn, reverseProxyBucket.bucketArn, cacheInvalidationQueue.queueArn);
        const webhookLambda = createLambdaFunction(this, 'rproxywebhookFunction', `twb-site-webhook-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/webhook-lambda/handler/deploy.zip'), webhooklambdaRole, 10, {
            WEBFLOW_V2_API_KEY: process.env.VITE_WEBFLOW_API_KEY,
            VITE_WEBFLOW_SITE_ID: process.env.VITE_WEBFLOW_SITE_ID,
            twb_WEBFLOW_SUBDOMAIN: webflowURL,
            twb_INTL_WEBFLOW_SUBDOMAIN: process.env.INTLWEBFLOWDOMAIN,
            REVERSEPROXY_MAPPING_TABLE_NAME: reverseProxyMappingTable.tableName,
            STATIC_FILES_S3_BUCKET_NAME: reverseProxyBucket.bucketName,
            SQS_QUEUE_URL: cacheInvalidationQueueUrl,
            WEBFLOW_LOGS_SLACK_WEBHOOK_URL: process.env.WEBFLOW_LOGS_SLACK_WEBHOOK_URL,
          });

          addLambdaPolicy(webhookLambda, [
            {
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: ['arn:aws:logs:*:*:*'],
            }
          ]);
      
          new cdk.CfnOutput(this, 'lambdaName', {
            value: webhookLambda.functionName,
            description: 'The name of webhook lambda function.',
          });

        const webhookLambdaUrl = webhookLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
        });

        new cdk.CfnOutput(this, "webhookLambdaUrl", {
            value: webhookLambdaUrl.url,
        });
        
        const urlMappingLambdaInlinePolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: ['dynamodb:*'],
                    resources: [`${reverseProxyMappingTable.tableArn}*`],
                }),
            ],
        });

        const urlMappingLambdaRole = createLambdaRoleWithInlinePolicy(this, 'URLMappingLambda', ['service-role/AWSLambdaBasicExecutionRole'], urlMappingLambdaInlinePolicy);

          const urlMappingLambda = createLambdaFunction(this, 'urlMappingLambda', `url-mapping-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/url-mapping-lambda/handler/deploy.zip'), urlMappingLambdaRole, 10, {
            WEBFLOW_API_KEY: process.env.VITE_WEBFLOW_API_KEY,
            WEBFLOW_SITE_ID: process.env.VITE_WEBFLOW_SITE_ID,
            REVERSEPROXY_MAPPING_TABLE_NAME: reverseProxyMappingTable.tableName,
          });
      
          addLambdaPolicy(urlMappingLambda, [
            {
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: ['arn:aws:logs:*:*:*'],
            }
          ]);


          const originLambdaRole = createLambdaRole(this, 'OriginLambdaRole', []);
          const originLambda = createLambdaFunction(this, 'OriginLambda', `twb-site-origin-lambda-${process.env.ENV}`, path.resolve(__dirname, '../src/origin-lambda/handler/deploy.zip'), originLambdaRole, 60);
          const originLambdaUrl = originLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
          });
          addLambdaPolicy(originLambda, [
            {
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: ['*'],
            }
          ]);

        // CLOUDFRONT
        const forwardCountryOriginReqPolicy = createOriginAccessPolicy(this, 'customOriginReqPolicy', `twb-site-proxy-${process.env.ENV}`, 'A custom policy for twb reverse proxy countries.', ['CloudFront-Viewer-Country-Region-Name', 'CloudFront-Viewer-Country', 'CloudFront-Viewer-Country-Name', 'CloudFront-Viewer-Country-Region']);
        let domainNames = [ domainName, domainName.replace(/^www\./, '')]
        const cloudFrontDistribution = createCloudFrontDistribution(this, 'WebAppDistro', domainNames, certificate,  cdk.Fn.select(2, cdk.Fn.split("/", originLambdaUrl.url)), forwardCountryOriginReqPolicy, [
            {
                functionVersion: viewerRequestLambda.currentVersion,
                eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST
            },
            {
                functionVersion: originRequestLambda.currentVersion,
                eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST
            },
            {
                functionVersion: originResponseLambda.currentVersion,
                eventType: cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE
            },
            {
                functionVersion: viewerResponseLambda.currentVersion,
                eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE
            }
          ]);

        // ROUTE53
        const hostedZoneId = `${process.env.WFJSHOSTEDZONEID}`;
        const zone = createHostedZone(this, "Zone", hostedZoneId, domainName);
        const rootDomain = createARecord(this, 'AliasRecord', zone, cloudFrontDistribution);
        const wwwDomain = createARecord(this, 'WWWRecord', zone, cloudFrontDistribution, domainName);
    }
}

module.exports = { ReverseProxyStack }
