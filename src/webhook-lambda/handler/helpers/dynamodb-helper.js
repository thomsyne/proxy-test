const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-10-08', region: 'us-east-1'});

const MAX_BATCH_SIZE = 25; // DynamoDB batchWrite limit

const _chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      chunks.push(chunk);
  }
  return chunks;
};

const _retryUnprocessedItems = (result, tableName) => {
  if (result.UnprocessedItems && result.UnprocessedItems[tableName]) {
      return { RequestItems: { [tableName]: result.UnprocessedItems[tableName] } };
  }
  return { RequestItems: {} };
};

const putItem = async (data,tableName) => {
    var params = {
        Item: data,
        TableName: tableName
    };
    return await ddb.put(params).promise();
};


const deleteItem = async(itemId,tableName) =>{
    const params = {
        TableName: tableName,
        Key: { id: itemId, dataSource: 'webflow' }
    };

  return await ddb.delete(params).promise();
}

const scan = async (tableName) => {
    try{
        var scanParameters = {
            TableName: tableName
        }
        var result = await ddb.scan(scanParameters).promise();
        if(Object.keys(result.Items).length === 0) return null;	
        return result.Items;
    }
    catch (ex){
        throw ex;
    }
}


const batchPutItems = async (itemsToPut, tableName) => {
    const batches = _chunkArray(itemsToPut, MAX_BATCH_SIZE);
    const results = [];

    for (const batch of batches) {
        const writeRequests = batch.map(item => ({ PutRequest: { Item: item } }));
        const params = { RequestItems: { [tableName]: writeRequests } };

        let unprocessedItems = params;

        do {
            const result = await ddb.batchWrite(unprocessedItems).promise();
            results.push(result);
            unprocessedItems = _retryUnprocessedItems(result, tableName);
        } while (Object.keys(unprocessedItems.RequestItems).length > 0);
    }

    return results;
};

const getItem = async (itemId, dataSource, tableName) => {
    const params = {
      TableName: tableName,
      Key: { 
        id: itemId,
        dataSource: dataSource // Add the sortKey here
      }
    };
    const result = await ddb.get(params).promise();
    if (!result.Item) return null;
    return result.Item;
  };
  
  module.exports = {
    putItem,
    deleteItem,
    scan,
    batchPutItems,
    getItem
  };
