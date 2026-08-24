require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");

const { fetchPerformance, pushCreativeToAssetGroup } = require("./lib/googleAds");
const { analyzePerformance, generateAlternative } = require("./lib/analyze");
const { generateImage } = require("./lib/imageGen");
const { readAll, saveSuggestions, setStatus, getById, updateSuggestion } = require("./lib/store");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { index: "dashboard.html" }));

function campaignContext() {
  return {
    campaignGoal: process.env.CAMPAIGN_GOAL || "",
    landingPageUrl: process.env.LANDING_PAGE_URL || "",
    targetAudience: process.env.TARGET_AUDIENCE || "",
  };
}

async function withGeneratedImage(creative) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  try {
    const imageUrl = await generateImage({ prompt: creative.assetStudioPrompt || creative.imageConcept, id });
    return { ...creative, imageUrl, imageError: null };
  } catch (err) {
    return { ...creative, imageUrl: null, imageError: err.message };
  }
}

app.get("/api/suggestions", (req, res) => {
  res.json(readAll());
});

app.post("/api/scan", async (req, res) => {
  try {
    const performance = await fetchPerformance();
    const analysis = await analyzePerformance(performance);

    const withImages = await Promise.all(
      (analysis.newCreatives || []).map(async (c) => ({
        ...(await withGeneratedImage(c)),
        assetGroupResourceName: performance.assetGroupResourceName,
        feedback: analysis.feedback,
      }))
    );

    const saved = saveSuggestions(withImages);
    res.json({
      source: performance.source,
      assets: performance.assets,
      feedback: analysis.feedback,
      assetInsights: analysis.assetInsights,
      newSuggestions: saved,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve: push the creative's headline, description, and generated image
// into the same Performance Max asset group it was analyzed from, as three
// new assets. Status only flips to "approved" if the push succeeds.
app.post("/api/suggestions/:id/approved", async (req, res) => {
  const suggestion = getById(req.params.id);
  if (!suggestion) return res.status(404).json({ error: "not found" });
  if (!suggestion.assetGroupResourceName) {
    return res.status(400).json({ error: "This suggestion has no asset group on record (from an older scan) — run Scan Now again." });
  }
  if (!suggestion.imageUrl) {
    return res.status(400).json({ error: "This suggestion has no generated image to push — decline it and let a new one generate." });
  }

  try {
    const imageBuffer = fs.readFileSync(path.join(__dirname, "public", suggestion.imageUrl));
    const pushResult = await pushCreativeToAssetGroup({
      assetGroupResourceName: suggestion.assetGroupResourceName,
      headline: suggestion.headline,
      description: suggestion.description,
      imageBuffer,
    });
    const updated = updateSuggestion(req.params.id, {
      status: "approved",
      decidedAt: new Date().toISOString(),
      pushResult,
      pushError: null,
    });
    res.json(updated);
  } catch (err) {
    updateSuggestion(req.params.id, { pushError: err.message });
    res.status(502).json({ error: `Push to Google Ads failed: ${err.message}` });
  }
});

// Decline: mark it declined, then immediately generate one alternative
// concept (different angle, not a reword) with its own generated image.
app.post("/api/suggestions/:id/declined", async (req, res) => {
  const suggestion = getById(req.params.id);
  if (!suggestion) return res.status(404).json({ error: "not found" });

  const declined = setStatus(req.params.id, "declined");

  try {
    const alt = await generateAlternative({
      declinedCreative: suggestion,
      feedback: suggestion.feedback || "",
      campaignContext: campaignContext(),
    });
    const withImage = await withGeneratedImage(alt);
    const [saved] = saveSuggestions([
      {
        ...withImage,
        assetGroupResourceName: suggestion.assetGroupResourceName,
        feedback: suggestion.feedback,
        replacesId: suggestion.id,
      },
    ]);
    res.json({ declined, alternative: saved });
  } catch (err) {
    res.json({ declined, alternative: null, alternativeError: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Creative Creator dashboard running at http://localhost:${port}`);
});
