#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { ReverseProxyStack } = require('../lib/reverse-proxy-stack');

const app = new cdk.App();
new ReverseProxyStack(app, `twb-site-proxy-${process.env.ENV}`, {
    env: {
        account: process.env.ACCOUNT,
        region: process.env.AWS_REGION,
    }
});