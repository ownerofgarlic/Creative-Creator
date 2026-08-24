require("dotenv").config();
const express = require("express");
const path = require("path");

const { fetchPerformance } = require("./lib/googleAds");
const { analyzePerformance } = require("./lib/analyze");
const { generateImage } = require("./lib/imageGen");
const { readAll, saveSuggestions, setStatus } = require("./lib/store");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { index: "dashboard.html" }));

app.get("/api/suggestions", (req, res) => {
  res.json(readAll());
});

app.post("/api/scan", async (req, res) => {
  try {
    const performance = await fetchPerformance();
    const analysis = await analyzePerformance(performance);

    const withImages = await Promise.all(
      (analysis.newCreatives || []).map(async (c, i) => {
        const id = `${Date.now()}-${i}`;
        try {
          const imageUrl = await generateImage({ prompt: c.assetStudioPrompt || c.imageConcept, id });
          return { ...c, imageUrl, imageError: null };
        } catch (err) {
          return { ...c, imageUrl: null, imageError: err.message };
        }
      })
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

app.post("/api/suggestions/:id/:decision", (req, res) => {
  const { id, decision } = req.params;
  if (!["approved", "declined"].includes(decision)) {
    return res.status(400).json({ error: "decision must be approved or declined" });
  }
  const updated = setStatus(id, decision);
  if (!updated) return res.status(404).json({ error: "not found" });
  res.json(updated);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Creative Creator dashboard running at http://localhost:${port}`);
});
