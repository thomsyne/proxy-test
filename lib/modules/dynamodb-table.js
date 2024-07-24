const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const cdk = require('aws-cdk-lib');

function createDynamoDBTable(stack, id, tableName, extra={}) {
  const table = new dynamodb.Table(stack, id, {
    tableName,
    partitionKey: {
      name: 'id',
      type: dynamodb.AttributeType.STRING
    },
    sortKey: {
      name: 'dataSource',
      type: dynamodb.AttributeType.STRING
    },
    replicationRegions: ['us-east-2', 'us-west-1', 'us-west-2'],
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    ...extra
  });

  table.addGlobalSecondaryIndex({
    indexName: 'targetUri',
    partitionKey: { name: 'targetUri', type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
  });

  table.addGlobalSecondaryIndex({
    indexName: 'vanityUrl',
    partitionKey: { name: 'vanityUrl', type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
  });

  return table;
}

module.exports = { createDynamoDBTable };
