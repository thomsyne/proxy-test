// VIEWER REQUEST
const dynamoDbHelper = require('./helpers/dynamodb-helper');

const internalRedirects = require("./internal-redirects.json");
const externalRedirects = require("./external-redirects.json");
const blocklist = require("./blocklist.json");

const paramsToQueryString = (params) => {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
};

const processQueryString = (queryString) => {
  const queryParams = queryString.split(/[&]/);
  let needsFix = false;

  queryParams.forEach((paramString) => {
    if (paramString) {
      if (paramString.includes("?")) {
        needsFix = true;
      }
    }
  });

  if (needsFix) {
    const queryParams = queryString.split(/[&?]/);
    const params = {};
    queryParams.forEach((paramString) => {
      if (paramString) {
        const [key, value] = paramString.split("=");
        params[key] = value;
      }
    });

    return {
      requiredFix: true,
      qs: paramsToQueryString(params),
    };
  }

  return {
    requiredFix: false,
    qs: queryString,
  };
};

exports.handler = async event => {
  try {
    const { request } = event.Records[0].cf;
    const host = request.headers.host[0].value;
    const referer = request.headers['referer'];
    const uri = request.uri.trim();
    let queryString = request.querystring;

    const requetUriHasTrailingSlash = uri.slice(-1) === "/";
    const requestUriWithoutEndingSlash = uri.replace(/\/+$/g, "");

    if(referer && referer.length > 0){
      let refererValue = referer[0].value;
      refererValue = refererValue.replace(/^https?:\/\//, "");
      refererValue = refererValue.replace(/\/.*$/, "");

      if(blocklist.includes(refererValue)){
        const response = {
          status: '302',
          statusDescription: 'Found',
          headers: {
              'location': [{
                  key: 'Location',
                  value: referer[0].value
              }]
          },
        };
    
        return response;
      }
    }

    console.log('host:', host);
    console.log('uri:', uri);
    
    if (!host.startsWith('www.')) {
      console.log('here')
      console.log('host:', host);
      console.log('uri:', uri);
      const redirectValue = `https://www.${host}${uri}`;
      return generateRedirectResponse(redirectValue, queryString);
    }

    if (uri !== "/" && requetUriHasTrailingSlash) {
      const redirectValue = `https://${host}${requestUriWithoutEndingSlash}`;
      return generateRedirectResponse(redirectValue, queryString);
    }

    if (queryString) {
      const queryStringProcessingResult = processQueryString(queryString);
      if (queryStringProcessingResult.requiredFix) {
        const redirectValue = `https://${host}${uri}`;
        return generateRedirectResponse(redirectValue, queryStringProcessingResult.qs);
      }
    }


    if (internalRedirects.hasOwnProperty(String(requestUriWithoutEndingSlash))) {
      const redirectValue = `https://${host}${internalRedirects[requestUriWithoutEndingSlash]}`;
      return generateRedirectResponse(redirectValue, queryString);
    }

    if (externalRedirects.hasOwnProperty(String(requestUriWithoutEndingSlash))) {
      const redirectValue = externalRedirects[requestUriWithoutEndingSlash];
      return generateRedirectResponse(redirectValue);
    }

    if(requestUriWithoutEndingSlash !== ""){
      const targetUriItem = await dynamoDbHelper.getItemByIndex(`twb-site-proxy-mapping-dev`, "targetUri", "targetUri", requestUriWithoutEndingSlash);
      if (targetUriItem) {
          let { vanityUrl } = targetUriItem;
          const redirectValue = `https://${host}${vanityUrl}`;
          return generateRedirectResponse(redirectValue, queryString);
      }
    }

    return request;
  } catch (error) {
    console.error("Error:", error);

    return {
      isBase64Encoded: false,
      statusCode: "500",
      statusDescription: "Internal Error",
      headers: { "Content-Type": "text/plain" },
      body: "An internal error occurred (L@E).",
    };
  }
};

const generateRedirectResponse = (redirectValue, querystring) => {
  if (querystring) {
    redirectValue += `?${querystring}`
  }
  const response = {
    status: '301',
    statusDescription: 'Found',
    headers: {
      location: [{
        key: 'Location',
        value: redirectValue
      }],
    },
  };

  return response;
}