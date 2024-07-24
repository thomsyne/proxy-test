const axios = require("axios");

const baseURL = 'https://webflow.new.dev.testweb.com';

const getUriLocale = (uri) => uri.match(/^\/([a-zA-Z]{2}-[a-zA-Z]{2})(?=\/|$)/)?.[1];

const locales = {
  'en-jp': `${baseURL}/en-us`
};

const getUrl = (path) => {
  const locale = getUriLocale(path);
  return locales[locale] 
    ? `${locales[locale]}${path.replace(`/${locale}`, '')}`
    : `${baseURL}${path}`;
};

exports.handler = async (event) => {
  console.log(event);
  const url = getUrl(event.rawPath);

  try {
    const response = await axios.get(url);
    const data = response.data;

    console.log("Data fetched successfully:", data);
    return {
      statusCode: 200,
      body: data,
      headers: {
        "Content-Type": "text/html",
      },
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to fetch data",
        error: error.message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
