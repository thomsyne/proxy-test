// ORIGIN RESPONSE

exports.handler = (event, _context, callback) => {
    console.log(event);
    try {
        const response = event.Records[0].cf.response;

        if (response.status == 404 || response.status == 500) {
            const redirect_path = "/";
            response.status = 302;
            response.statusDescription = 'Found';

            response.body = '';
            response.headers['location'] = [{ key: 'Location', value: redirect_path }];
        }

        callback(null, response);
    } catch (error) {
        console.log(error);
    }
};