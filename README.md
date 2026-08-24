# Creative-Creator

`index.html` — the live donation landing page for Team Shalva NY 2026.

`server/` — the Creative Creator dashboard: scans your Google Ads campaign's
creative performance and suggests new creatives for you to approve or decline.

## Running the dashboard

```
cd server
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000 and click **Scan Now**.

By default `.env` has `MOCK_MODE=true`, so you can try the whole flow —
scan, feedback, approve/decline — with realistic sample data and no
accounts to set up.

## Going live: Google Ads API setup

1. In Google Ads, apply for API access under Tools & Settings → API Center
   to get a **developer token**. (Google reviews this; a "test account"
   token works immediately for your own account while you wait.)
2. In [Google Cloud Console](https://console.cloud.google.com), create a
   project, enable the Google Ads API, and create OAuth 2.0 credentials
   (Client ID + Client Secret).
3. Use the OAuth playground or Google's
   [generate_refresh_token script](https://github.com/Opteo/google-ads-api#authentication)
   to turn those into a refresh token for your Google Ads account.
4. Fill in `server/.env`:
   - `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
     `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
     `GOOGLE_ADS_CUSTOMER_ID` (your 10-digit Ads account ID, no dashes)
   - `GOOGLE_ADS_LOGIN_CUSTOMER_ID` only if that account sits under a
     manager (MCC) account
   - Set `MOCK_MODE=false`

## Turning on AI analysis

Get a free-to-start API key at https://console.anthropic.com and set
`ANTHROPIC_API_KEY` in `.env` (with `MOCK_MODE=false`). This powers the
feedback summary and new creative copy/concepts, using your campaign goal,
landing page, and audience (also set in `.env`) as context.

## How the new creatives actually get generated

This is the automated part end to end, no external tool or manual step
required:

1. Claude reads the performance data and writes a headline, description,
   and an image-generation prompt for each new creative concept.
2. The server sends that prompt to **Pollinations.ai**
   (`server/lib/imageGen.js`) — a free, keyless text-to-image API — and
   saves the returned image to `server/public/generated/`.
3. The dashboard shows the actual generated image on each creative card,
   next to Approve/Decline.

No account or API key is needed for image generation; it just works once
the server can reach the internet. (If image generation fails for any
reason, the card falls back to showing the text concept instead of the
image, with the error noted — scanning still completes.)

Swap `generateImage` in `server/lib/imageGen.js` for a different provider
(e.g. Stability AI, an OpenAI images key, Google's Imagen) if you want
higher-quality output later — the rest of the pipeline doesn't change.

## What "Scan Now" does

1. Pulls the last 30 days of asset-level performance (headlines,
   descriptions, images) from your Performance Max campaign via the
   Google Ads API.
2. Sends that data — plus your campaign goal, landing page, and target
   audience — to Claude for analysis.
3. Generates an actual image for each new creative via a free AI
   image API (see below), so you're reviewing a real preview, not just
   text.
4. Shows a feedback summary, a keep/improve/pause verdict per asset, and
   2 new creative suggestions (image + copy) with reasoning.
5. Click **Approve** and the headline, description, and image are pushed
   as three new assets into the *same* Performance Max asset group they
   were analyzed from, via the Google Ads API (`pushCreativeToAssetGroup`
   in `server/lib/googleAds.js`) — no manual upload. The card shows
   "Pushed to Google Ads asset group" once it succeeds, or the API error
   if it doesn't (nothing is left half-applied).
6. Click **Decline** and it's marked declined, then a fresh alternative —
   a different angle, not a reworded headline — is generated and added to
   the board automatically, with its own image, ready to approve or
   decline in turn.

In `MOCK_MODE=true`, Approve simulates the push (labeled "mock — no real
account") instead of calling the real API, so you can test the full
approve/decline loop before connecting your Google Ads account.
