const MOCK_ASSET_GROUP_RESOURCE_NAME = "customers/1234567890/assetGroups/9999999999";

const MOCK_ASSETS = [
  {
    id: "mock-headline-1",
    type: "HEADLINE",
    text: "Help a Child With Disabilities Thrive",
    impressions: 18420,
    clicks: 612,
    ctr: 0.0332,
    conversions: 41,
  },
  {
    id: "mock-headline-2",
    type: "HEADLINE",
    text: "Run With Us. Change a Life.",
    impressions: 9110,
    clicks: 118,
    ctr: 0.013,
    conversions: 6,
  },
  {
    id: "mock-description-1",
    type: "DESCRIPTION",
    text: "Support Shalva's marathon team and help fund care for children and adults with disabilities.",
    impressions: 18420,
    clicks: 612,
    ctr: 0.0332,
    conversions: 41,
  },
  {
    id: "mock-image-square",
    type: "IMAGE",
    text: "square-1200x1200.png (logo on sand background)",
    impressions: 15230,
    clicks: 301,
    ctr: 0.0198,
    conversions: 19,
  },
  {
    id: "mock-image-landscape",
    type: "IMAGE",
    text: "landscape-1200x628.png (marathon runners)",
    impressions: 22110,
    clicks: 890,
    ctr: 0.0403,
    conversions: 58,
  },
];

async function fetchMockPerformance() {
  return {
    source: "mock",
    campaign: { name: "Team Shalva NY 2026 Marathon - Performance Max", goal: "Donations" },
    dateRange: "last_30_days",
    assetGroupResourceName: MOCK_ASSET_GROUP_RESOURCE_NAME,
    assets: MOCK_ASSETS,
  };
}

function requireLiveCredentials() {
  const required = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing Google Ads credentials: ${missing.join(", ")}. Set MOCK_MODE=true to try the dashboard without them, or fill in server/.env.`
    );
  }
}

function getCustomer() {
  const { GoogleAdsApi } = require("google-ads-api");
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });
  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

async function fetchLivePerformance() {
  requireLiveCredentials();
  const customer = getCustomer();

  // Asset-level performance for the last 30 days (headlines, descriptions,
  // images), plus which asset group each asset belongs to — that asset
  // group is where approved creatives get pushed back to.
  const rows = await customer.query(`
    SELECT
      asset.id,
      asset.type,
      asset.text_asset.text,
      asset.image_asset.full_size.url,
      asset_group.id,
      asset_group.resource_name,
      asset_group.campaign,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions
    FROM asset_group_asset
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 50
  `);

  if (!rows.length) {
    throw new Error(
      "No asset_group_asset rows returned for the last 30 days. Confirm GOOGLE_ADS_CUSTOMER_ID points at the account running the Performance Max campaign, and that it has recent traffic."
    );
  }

  const assets = rows.map((r) => ({
    id: String(r.asset.id),
    type: r.asset.type,
    text: r.asset.text_asset?.text || r.asset.image_asset?.full_size?.url || "(untitled asset)",
    impressions: r.metrics?.impressions || 0,
    clicks: r.metrics?.clicks || 0,
    ctr: r.metrics?.ctr || 0,
    conversions: r.metrics?.conversions || 0,
  }));

  // Assumes a single Performance Max asset group (true for this fundraiser
  // campaign). If you run more than one, this takes the first one seen.
  const assetGroupResourceName = rows[0].asset_group.resource_name;

  return {
    source: "live",
    campaign: { name: "Google Ads account " + process.env.GOOGLE_ADS_CUSTOMER_ID, goal: process.env.CAMPAIGN_GOAL || "" },
    dateRange: "last_30_days",
    assetGroupResourceName,
    assets,
  };
}

async function fetchPerformance() {
  const mock = String(process.env.MOCK_MODE).toLowerCase() === "true";
  return mock ? fetchMockPerformance() : fetchLivePerformance();
}

// Pushes one creative (headline + description + image) into a Performance
// Max asset group as three new assets, linked via asset_group_asset. Uses
// Google Ads API "temporary resource names" (negative ids) so the three
// CREATE operations can reference each other inside one mutate request.
async function pushCreativeToAssetGroup({ assetGroupResourceName, headline, description, imageBuffer }) {
  const mock = String(process.env.MOCK_MODE).toLowerCase() === "true";
  if (mock) {
    return {
      mock: true,
      headlineAsset: "customers/1234567890/assets/-1 (mock)",
      descriptionAsset: "customers/1234567890/assets/-2 (mock)",
      imageAsset: "customers/1234567890/assets/-3 (mock)",
    };
  }

  requireLiveCredentials();
  const { enums } = require("google-ads-api");
  const customer = getCustomer();
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

  const headlineTemp = `customers/${customerId}/assets/-1`;
  const descriptionTemp = `customers/${customerId}/assets/-2`;
  const imageTemp = `customers/${customerId}/assets/-3`;

  const operations = [
    {
      entity: "asset",
      operation: "create",
      resource: { resource_name: headlineTemp, type: enums.AssetType.TEXT, text_asset: { text: headline } },
    },
    {
      entity: "asset",
      operation: "create",
      resource: { resource_name: descriptionTemp, type: enums.AssetType.TEXT, text_asset: { text: description } },
    },
    {
      entity: "asset",
      operation: "create",
      resource: {
        resource_name: imageTemp,
        type: enums.AssetType.IMAGE,
        image_asset: { data: imageBuffer.toString("base64") },
      },
    },
    {
      entity: "asset_group_asset",
      operation: "create",
      resource: { asset_group: assetGroupResourceName, asset: headlineTemp, field_type: enums.AssetFieldType.HEADLINE },
    },
    {
      entity: "asset_group_asset",
      operation: "create",
      resource: { asset_group: assetGroupResourceName, asset: descriptionTemp, field_type: enums.AssetFieldType.DESCRIPTION },
    },
    {
      entity: "asset_group_asset",
      operation: "create",
      resource: { asset_group: assetGroupResourceName, asset: imageTemp, field_type: enums.AssetFieldType.MARKETING_IMAGE },
    },
  ];

  const response = await customer.mutateResources(operations);
  return { mock: false, results: response.mutate_operation_responses || response };
}

module.exports = { fetchPerformance, pushCreativeToAssetGroup };
