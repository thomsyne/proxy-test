// VIEWER RESPONSE

exports.handler = (event, context, callback) => {
    console.log(event);
    const request = event.Records[0].cf.request;
    const response = event.Records[0].cf.response;
    const debugInfo = {
        request: {
            uri: request.uri,
            queryString: request.querystring,
            method: request.method
        },
        response: response
    };
    console.log(JSON.stringify(debugInfo));
    callback(null, response);
};
