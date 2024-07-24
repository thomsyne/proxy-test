const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-10-08', region: 'us-east-1'});

const getItemByIndex = async (tableName,indexName,indexKey,indexValue) => {
    try{
        var queryParameters = {
            TableName: tableName,
            IndexName: indexName,
            KeyConditionExpression: "#n0 = :v0",
            ExpressionAttributeNames: {
                "#n0": indexKey
            },
            ExpressionAttributeValues: {
                ":v0": indexValue
            }
        }
        var result = await ddb.query(queryParameters).promise();
        if(Object.keys(result.Items).length === 0) return null;	
        return result.Items[0];
    }
    catch (ex){
        throw ex;
    }
   
}

module.exports ={
    getItemByIndex
}