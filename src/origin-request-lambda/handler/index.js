// ORIGIN REQUEST

const config = require('./config');

const dynamoDbHelper = require("./helpers/dynamodb-helper");
const supportedCountries = require("./supported-countries.json");

const getUriLocale = (uri) => {    
  const localeRegex = /^\/([a-zA-Z]{2}-[a-zA-Z]{2})(?=\/|$)/;
  return uri.match(localeRegex)?.[1];
}

exports.handler = async (event, _context, callback) => {
  try {
    const { newSiteDomain } = config;
    const { request } = event.Records[0].cf;
    const uri = request.uri.trim().replace(/\/+$/g, "") || "/";
    const queryString = request.querystring;

    const cfCountryCode = request.headers["cloudfront-viewer-country"]?.[0]?.value?.toLowerCase() || "";
    const cfRegionCode = request.headers["cloudfront-viewer-country-region"]?.[0]?.value?.toLowerCase() || "";

    console.log('CC:', cfCountryCode);
    console.log('RC:', cfRegionCode);

      console.log('uri:', uri);
      console.log('newSiteDomain:', newSiteDomain);

    if (uri === "/" || uri === "/locations" || uri === "/articles") {
      console.log('here 1, 2')
      let locale = "en-us";
      if (supportedCountries.hasOwnProperty(String(cfCountryCode))) {
        if (cfCountryCode === "ca" && cfRegionCode === "qc") {
          locale = "fr-ca";
        } else {
          locale = supportedCountries[cfCountryCode]["default-locale"];
        }
      }

      console.log('locale:', locale);
      console.log('uri:', uri);
      console.log('newSiteDomain:', newSiteDomain);
      
      let redirection = `https://${newSiteDomain}/${locale}${uri}`;
      if (locale === "en-us"){
        if (redirection.endsWith('/')) {
          redirection = redirection.slice(0, -1);
        }
      }

      console.log('redirection: ', redirection)

      const response = generateRedirectResponse(
        redirection,
        queryString
      );
      callback(null, response);
      return;
    }
      
    const uriLocale = getUriLocale(request.uri)

    // TODO: find out why trailing slashes lead to redirection to webflow for en-us locale
    if ((!uriLocale || request.uri.toLowerCase().startsWith('/en-us')) && request.uri.endsWith('/')) {
      request.uri = request.uri.replace(/\/+$/g, "")
    }

    let requestUriWithoutEndingSlash = uri.replace(/\/$/, "");
    if (requestUriWithoutEndingSlash) {
      const item = await dynamoDbHelper.getItemByIndex(
        `twb-site-proxy-mapping-dev`,
        "vanityUrl",
        "vanityUrl",
        requestUriWithoutEndingSlash
      );
      if (item) {
        const { targetUri } = item;
        request.uri = targetUri;
      }
    }

    request.headers['x-user-country'] = [{ key: 'X-User-Country', value: cfCountryCode }];
    console.log('request.uri:', request.uri);
    console.log('request', request)

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
  console.log('redirectValue:', redirectValue);
  let location = redirectValue;
  if (querystring) {
    location += `?${querystring}`;
  }

  const response = {
    status: "302",
    statusDescription: "Found",
    headers: {
      location: [
        {
          key: "Location",
          value: location,
        },
      ]
    },
  };

  return response;
};