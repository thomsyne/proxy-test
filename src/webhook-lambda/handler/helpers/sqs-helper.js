const AWS = require("aws-sdk");

const sqs = new AWS.SQS();

const queueCloudFrontCacheInvalidation = async (queueUrl, paths) => {
  const message = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify({
      origin: "webflow-webhook-request",
      paths: paths,
    }),
  };

  console.log("Sending Message: ", message);

  await sqs.sendMessage(message).promise();
};

module.exports = {
    queueCloudFrontCacheInvalidation
}