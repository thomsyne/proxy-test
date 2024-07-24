const AWS = require("aws-sdk");
const s3 = new AWS.S3();

const putObject = async (data,key,bucketName) => {
    var params = {
      Body: data, 
      Bucket: bucketName, 
      Key: key,
      ContentType: "text/xml"
     };
    return await s3.putObject(params).promise();
};

module.exports ={
    putObject
}