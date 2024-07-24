const axios = require("axios");

const dynamoDbHelper = require("./helpers/dynamodb-helper");

const axiosInstance = axios.create({
    baseURL: "https://api.webflow.com/v2",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
      "content-type": "application/json",
    },
  });

exports.handler = async (event, _context, callback) => {
    try {
        const webflowSiteId = process.env.WEBFLOW_SITE_ID;

        const site = await axiosInstance.get(
            `/sites/${webflowSiteId}`
        );

        console.log(site.data.locales);

    } catch (error) {
        console.error("Error:", error);
    }
}