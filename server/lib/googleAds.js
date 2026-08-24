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
    assets: MOCK_ASSETS,
  };
}

async function fetchLivePerformance() {
  const { GoogleAdsApi } = require("google-ads-api");

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

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  // Asset-level performance for the last 30 days (headlines, descriptions, images).
  const rows = await customer.query(`
    SELECT
      asset.id,
      asset.type,
      asset.text_asset.text,
      asset.image_asset.full_size.url,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.conversions
    FROM asset_group_asset
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 50
  `);

  const assets = rows.map((r) => ({
    id: String(r.asset.id),
    type: r.asset.type,
    text: r.asset.text_asset?.text || r.asset.image_asset?.full_size?.url || "(untitled asset)",
    impressions: r.metrics?.impressions || 0,
    clicks: r.metrics?.clicks || 0,
    ctr: r.metrics?.ctr || 0,
    conversions: r.metrics?.conversions || 0,
  }));

  return {
    source: "live",
    campaign: { name: "Google Ads account " + process.env.GOOGLE_ADS_CUSTOMER_ID, goal: process.env.CAMPAIGN_GOAL || "" },
    dateRange: "last_30_days",
    assets,
  };
}

async function fetchPerformance() {
  const mock = String(process.env.MOCK_MODE).toLowerCase() === "true";
  return mock ? fetchMockPerformance() : fetchLivePerformance();
}

module.exports = { fetchPerformance };
