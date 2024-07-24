const fetch = require("node-fetch");
const axios = require("axios");
const dynamoDbHelper = require("./helpers/dynamodb-helper");
const s3Helper = require("./helpers/s3-helper");
const sqsHelper = require("./helpers/sqs-helper");
const { URL } = require("url");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");

//Load Environment Variables
const bucketName = `${process.env.STATIC_FILES_S3_BUCKET_NAME}`;
const webflowSitemapUrl = `https://${process.env.twb_WEBFLOW_SUBDOMAIN}/sitemap.xml`;
const webflowProductionSubdomain = `${process.env.twb_WEBFLOW_SUBDOMAIN}`;
const intlWebflowProductionSubdomain = process.env.twb_INTL_WEBFLOW_SUBDOMAIN;
const reverseProxyMappingTableName = `${process.env.REVERSEPROXY_MAPPING_TABLE_NAME}`;
const partnersCollectionId = "654b1dc8482f520055dbc24b";
const partnerPageUriPrefix = "/en-us/partner/";
const sitemapOnlyVanityUrlPostfix = "/sitemap-only-vanity-url";
const sitemapOnlyTargetUriPostfix = "/sitemap-only-target-uri";

const sqsQueueUrl = process.env.SQS_QUEUE_URL;
const webflowLogsSlackWebhookUrl = process.env.WEBFLOW_LOGS_SLACK_WEBHOOK_URL;

const slugMap = {
  articles: "articles",
  locations: "locations",
  "at-home-articles": "athome/all-otathome-articles",
  coop: "coop",
};

const axiosInstance = axios.create({
  baseURL: "https://api.webflow.com/v2",
  headers: {
    accept: "application/json",
    authorization: `Bearer ${process.env.WEBFLOW_V2_API_KEY}`,
    "content-type": "application/json",
  },
});


const getLocalesMap = async () => {
  const localeTargetMap = {};
  const localeIdMap = {};
  const site = await axiosInstance.get(
    `/sites/${process.env.VITE_WEBFLOW_SITE_ID}`
  );

  site.data.locales.secondary.forEach((locale) => {
    const localeCode = locale.subdirectory.split("-")[1].toLowerCase();
    if (!localeTargetMap[localeCode]) {
      localeTargetMap[localeCode] = [];
    }
    localeTargetMap[localeCode].push(locale.cmsLocaleId);
    localeIdMap[locale.cmsLocaleId] = locale.subdirectory;
  });

  return { localeTargetMap, localeIdMap };
};

const validateSchema = async (collectionId, fieldData) => {
  const { data: collectionInfo } = await axiosInstance.get(
    `/collections/${collectionId}`
  );
  return collectionInfo?.fields?.reduce((obj, { slug }) => {
    if (slug in fieldData) {
      obj[slug] = fieldData[slug];
    }
    return obj;
  }, {});
};

const syncLocales = async (itemId, collectionId, fieldData, currentLocale) => {
  const { localeTargetMap, localeIdMap } = await getLocalesMap();

  const currentLocaleCode = localeIdMap[currentLocale]?.split("-")[1];
  const targetLocales = localeTargetMap[currentLocaleCode];
  const sanitizedFieldData = await validateSchema(collectionId, fieldData)
  console.log("targetLocales", targetLocales);

  for (let targetLocale of targetLocales) {
    if (targetLocale === currentLocale) continue;

    try {
      let response;
      const endpoint = `/collections/${collectionId}/items/${itemId}`;
      console.log("endpoint", endpoint);
      const body = {
        cmsLocaleId: targetLocale,
        fieldData: sanitizedFieldData,
      };
      console.log("body", body);

      response = await axiosInstance.patch(endpoint, body);

      console.log(`Item updated successfully:`, response.data);
    } catch (error) {
      console.error(
        "Error updating item:",
        error.response ? error.response.data : error.message
      );
    }
  }
};

exports.handler = async (request) => {
  const { body } = request;
  console.log("BODY: ", body);

  const event = JSON.parse(body);
  console.log("EVENT: ", event);

  let {
    id,
    siteId,
    workspaceId,
    collectionId,
    lastPublished,
    lastUpdated,
    createdOn,
    isArchived,
    isDraft,
  } = event.payload;

  const { _locale: cmsLocaleId, ...fieldData } = event.payload.fieldData;
  const domains = event?.payload?.domains;

  console.log("DOMAINS: ", domains);

  try {
    if (domains) {
      try {
        // SITE WIDE PUBLISH EVENT
        if (domains.includes(webflowProductionSubdomain)) {
          console.log("SITE PUBLISH EVENT!");
          const items = await dynamoDbHelper.scan(reverseProxyMappingTableName);
          const partnerSitemapItems = items.filter(
            partnersSitemapOnlyItemFilter
          );

          const partnerSitemapItemsUpdates = [];
          partnerSitemapItems.forEach((item) => {
            if (item.published && (item.archived || item.draft)) {
              partnerSitemapItemsUpdates.push({ ...item, published: false });
            } else if (!(item.draft || item.archived || item.published)) {
              partnerSitemapItemsUpdates.push({ ...item, published: true });
            }
          });

          await dynamoDbHelper.batchPutItems(
            partnerSitemapItemsUpdates,
            reverseProxyMappingTableName
          );

          console.log("INVALIDATING CACHE!!");
          console.log("SQS QUEUE: ", sqsQueueUrl);

          await sqsHelper.queueCloudFrontCacheInvalidation(sqsQueueUrl, ["/*"]);
        } else if (domains.includes(intlWebflowProductionSubdomain)) {
          console.log("INVALIDATING CACHE DUE TO INTL PUBLISH!!");
          console.log("SQS QUEUE: ", sqsQueueUrl);

          await sqsHelper.queueCloudFrontCacheInvalidation(sqsQueueUrl, ["/*"]);
        }
      } catch (err) {
        console.log(err);
      }
    }

    if (event.triggerType === "collection_item_deleted" || isDraft) {
      console.log("ITEM DELETION EVENT!");
      await dynamoDbHelper.deleteItem(id, reverseProxyMappingTableName);
    }

    if (
      event.triggerType === "collection_item_created" ||
      event.triggerType === "collection_item_changed"
    ) {
      
      const vanityurl = fieldData.vanityurl;
      const slug = fieldData.slug;

      if (
        !isDraft &&
        vanityurl &&
        event.triggerType !== "collection_item_deleted"
      ) {
        //CMS ITEM UPDATE EVENT
        console.log("ITEM UPDATE EVENT!");
        let vanityUrlTrimmed = vanityurl.trim().replace(/\/$/, ""); // Removing any leading or trailing whitespace, additionally removing a trailing slash (/) from the URL if it exists.
        let collectionSlug = vanityUrlTrimmed.split("/")[2]; // Getting the slug from the URL
        const currentTime = Date.now();

        if (collectionSlug === "athome") {
          collectionSlug = "at-home-articles";
        }

        //sync locales
        const item =
          (await dynamoDbHelper.getItem(
            id,
            "webflow",
            reverseProxyMappingTableName
          )) || {};
        console.log("item", item);

        const fiveSeconds = 5 * 1000;

        const lastUpdatedTime = item.lastUpdated
          ? parseInt(item.lastUpdated, 10)
          : 0;
        const difference = Math.abs(currentTime - lastUpdatedTime);
        console.log("difference", difference);

        if (difference > fiveSeconds) {
          let data = {
            id,
            dataSource: "webflow",
            vanityUrl: vanityUrlTrimmed,
            targetUrlDomain: webflowProductionSubdomain,
            targetUri: `/${collectionSlug}/${slug}`,
            lastUpdated: currentTime
          };
          console.log("before putting", data);
  
          await dynamoDbHelper.putItem(data, reverseProxyMappingTableName);
          await syncLocales(id, collectionId, fieldData, cmsLocaleId);
        }
      }

      //add partners collection item for sitemap inclusion
      if (!isArchived && collectionId === partnersCollectionId) {
        const uri = `${partnerPageUriPrefix}${slug}`;
        const data = {
          id,
          dataSource: "webflow",
          vanityUrl: `${uri}${sitemapOnlyVanityUrlPostfix}`,
          targetUrlDomain: webflowProductionSubdomain,
          targetUri: `${uri}${sitemapOnlyTargetUriPostfix}`,
          draft: isDraft,
          archived: isArchived,
          published: !!lastPublished,
        };

        await dynamoDbHelper.putItem(data, reverseProxyMappingTableName);
      }
    }

    await regenerateSitemap();
  } catch (e) {
    console.log(e);

    return {
      statusCode: 400,
    };
  }

  return {
    statusCode: 200,
  };
};

const regenerateSitemap = async () => {
  //Fetch dynamodb data.
  const items = await dynamoDbHelper.scan(reverseProxyMappingTableName);

  //Fetch webflow sitemap xml
  let xml = await fetch(webflowSitemapUrl, {
    method: "GET",
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  });

  //Get xml from response text
  let xmlString = await xml.text();

  //Parse the xml to json
  const parserOptions = {
    ignoreAttributes: false,
  };
  const parser = new XMLParser(parserOptions);
  const parsedString = parser.parse(xmlString);

  //Get urls from parsed json
  let itemsJSON = parsedString;
  let urls = itemsJSON.urlset.url;

  // exclude any partners pages urls initially
  urls = urls.filter((url) => !url.loc.includes(partnerPageUriPrefix));
  // only include partner pages urls if present in DynamoDB mapping (published)
  urls.push(
    ...items
      .filter(partnersSitemapOnlyPublishedItemFilter)
      .map(({ vanityUrl }) => ({
        loc: `https://webflow.testweb.com${vanityUrl.replace(
          sitemapOnlyVanityUrlPostfix,
          ""
        )}`,
      }))
  );

  //Put together the sitemap url list.
  urls = urls
    .map((url) => {
      let replacedDomain = url.loc.replace("webflow", "www"); // https://webflow.testweb.com/ -> https://www.testweb.com/
      let loc = transform(items, replacedDomain); // Translate urls to vanity urls when necessary (e.g. https://www.testweb.com/locations/0b39685b-39e7-4ecf-b0e7-c61156b1afe8 -> https://www.testweb.com/en-us/locations/florida/jacksonville/9610-applecross-rd-suite-102)

      return {
        loc: loc, //We get rid of most xml attributes, just keeping loc per each original sitemap entry
      };
    })
    .filter((url) => shouldIncludeInSitemap(url.loc)); //filter out stuff that doesn't match (basically exclude online-join-<env>)
  const options = {
    ignoreAttributes: false,
  };

  //Replace urlset urls in original json object with the updated one
  itemsJSON.urlset.url = urls;

  //Rebuilding xml file
  const builder = new XMLBuilder(options);
  let xmlDataStr = builder.build(itemsJSON);

  //Upload the resulting xml file to s3, specifically replacing previous us sitemap.
  return await s3Helper.putObject(xmlDataStr, "en-us/sitemap.xml", bucketName); //Write to S3
};

const shouldIncludeInSitemap = (url) => {
  return (
    /^https:\/\/www\.testweb\.com\/en-us/.test(url) &&
    !/^https:\/\/www\.testweb\.com\/en-us\/locations\/online-join-sit-/.test(
      url
    ) &&
    !/^https:\/\/www\.testweb\.com\/en-us\/locations\/online-join-uat-/.test(
      url
    ) &&
    !/^https:\/\/www\.testweb\.com\/en-us\/locations\/online-join-prod-/.test(
      url
    ) &&
    !/^https:\/\/www\.testweb\.com\/en-us\/locations\/online-join-promo-/.test(
      url
    ) &&
    !url.endsWith("/en-us/healthcare-membership-redemption")
  );
};

const transform = (items, urlString) => {
  let url = new URL(urlString);
  let pathname = url.pathname;
  let host = url.host;

  if (pathname === "/") {
    urlString = `https://${host}/en-us`; //Cause we are only building the us sitemap
  } else if (
    !pathname.startsWith("/en-us/coop") &&
    !pathname.startsWith("/en-us")
  ) {
    //Get the slug that matched the collection type in webflow (articles. locations. coop. at-home-articles.)
    let slug = pathname.split("/")[1];
    //If it contains an slug accounted for we proceed
    if (Object.keys(slugMap).includes(slug)) {
      //Look for item in ddb, with pathname as reference (e.g. /locations/0b39685b-39e7-4ecf-b0e7-c61156b1afe8)
      let item = items.find((item) => item.targetUri === pathname);
      if (item) {
        //If the item is found, get the vanity url (e.g. (from above) /en-us/locations/florida/jacksonville/9610-applecross-rd-suite-102)
        const { vanityUrl } = item;
        if (vanityUrl) {
          //If item has vanity url (haven't seen one without them in ddb, but I guess it also depend on the sitemap)
          urlString = `https://${host}${vanityUrl}`;
        }
      }
    }
  }
  return urlString;
};

function partnersSitemapOnlyItemFilter(item) {
  return (
    item?.vanityUrl?.startsWith(partnerPageUriPrefix) &&
    item?.vanityUrl?.endsWith(sitemapOnlyVanityUrlPostfix)
  );
}

function partnersSitemapOnlyPublishedItemFilter(item) {
  return partnersSitemapOnlyItemFilter(item) && item?.published;
}

const sendWebflowLogSlackMessage = async (topic, detail) => {
  const webflowLogsSlackPostResponse = await axios.post(
    webflowLogsSlackWebhookUrl,
    {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${topic}`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "plain_text",
            text: `${detail}`,
            emoji: true,
          },
        },
      ],
    }
  );

  console.log(
    `Webflow log message sent to slack! - Response: ${webflowLogsSlackPostResponse.data}`
  );
};
