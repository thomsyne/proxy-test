
const config = require("./config");

const supportedCountries = require("./supported-countries.json");

exports.handler = async (event, _context, callback) => {
    try {
        const { newSiteDomain } = config;
        const { request } = event.Records[0].cf;
        const uri = request.uri.trim().replace(/\/+$/g, "") || "/";
        const queryString = request.querystring;

        console.log(request);

        const cfCountryCode = request.headers["cloudfront-viewer-country"]?.[0]?.value?.toLowerCase() || "";
        const cfRegionCode = request.headers["cloudfront-viewer-country-region"]?.[0]?.value?.toLowerCase() || "";

        console.log("URI: ", uri);
        console.log("CC: ", cfCountryCode);
        console.log("RC: ", cfRegionCode);
        console.log("QS: ", queryString);

        console.log("LOCALE LESS REDIIRECT");

        let locale = "en-us";
        if (supportedCountries.hasOwnProperty(String(cfCountryCode))) {
            if (cfCountryCode === "ca" && cfRegionCode === "qc") {
                locale = "fr-ca";
            } else {
                locale = supportedCountries[cfCountryCode]["default-locale"];
            }
        }

        let redirection = `https://${newSiteDomain}/${locale}${uri}`;
        console.log(redirection, 'redirreee')
        if (locale === "en-us") {
            if (redirection.endsWith('/')) {
                redirection = redirection.slice(0, -1);
            }
        }

        return generateRedirectResponse(
            redirection,
            queryString
        );
    } catch (error) {
        console.log(error);
    }
};


const generateRedirectResponse = (redirectValue, querystring) => {
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