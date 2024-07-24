const AWS = require('aws-sdk');

// Configure the AWS region
AWS.config.update({
  region: 'us-east-1'
});

// Create the DynamoDB service object
const dynamodb = new AWS.DynamoDB.DocumentClient();

const sourceTableName = 'webflow-intl-proxy-dev';
const destinationTableName = 'twb-site-proxy-mapping-dev';

// Function to scan all items in a table
async function scanTable(tableName) {
  const items = [];
  let params = { TableName: tableName };
  
  do {
    const data = await dynamodb.scan(params).promise();
    items.push(...data.Items);
    params.ExclusiveStartKey = data.LastEvaluatedKey;
  } while (typeof params.ExclusiveStartKey !== 'undefined');

  return items;
}

// Function to write items to the destination table
async function writeToDestination(items) {
  const chunks = []; // array of promises
  while (items.length) {
    // DynamoDB batchWrite can handle up to 25 items at a time
    let batch = items.splice(0, 25);
    let requestItems = {};
    requestItems[destinationTableName] = batch.map(item => ({
      PutRequest: {
        Item: item
      }
    }));

    chunks.push(dynamodb.batchWrite({ RequestItems: requestItems }).promise());
  }
  await Promise.all(chunks);
}

exports.handler = async (event, context) => {
  try {
    const items = await scanTable(sourceTableName);
    await writeToDestination(items);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Data copy completed successfully.' }),
    };
  } catch (error) {
    console.error('Error copying data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error copying data', error: error }),
    };
  }
};
