const MOCK_ANALYSIS = {
  feedback:
    "Landscape imagery of runners is your strongest performer (4.0% CTR, best conversion rate) — action/emotion beats the static logo. \"Help a Child With Disabilities Thrive\" beats \"Run With Us. Change a Life.\" by 2.5x CTR, suggesting concrete, specific outcome-language outperforms generic calls to action. The square logo asset is underperforming and is a candidate to pause.",
  assetInsights: [
    { id: "mock-image-landscape", verdict: "keep", note: "Best CTR and conversion rate — action imagery resonates." },
    { id: "mock-headline-1", verdict: "keep", note: "Specific, outcome-focused headline is your top performer." },
    { id: "mock-headline-2", verdict: "improve", note: "Generic phrasing underperforms; needs a concrete outcome." },
    { id: "mock-image-square", verdict: "pause", note: "Lowest CTR of image assets; static logo lacks emotional pull." },
  ],
  newCreatives: [
    {
      headline: "One Mile Funds One Week of Therapy",
      description: "Join Team Shalva NY 2026 and turn every mile into real support for children and adults with disabilities.",
      imageConcept: "Close-up, warm-toned photo of a Shalva participant crossing the finish line, arms raised, teal/navy brand colors in background signage.",
      assetStudioPrompt: "Warm, candid photo of a joyful marathon finisher crossing a finish line, teal and navy accent colors, natural light, inclusive and emotional tone, square crop 1200x1200",
      rationale: "Mirrors the winning landscape/action pattern while adding a concrete, specific value statement like your top headline.",
    },
    {
      headline: "Every Runner Has a Reason. What's Yours?",
      description: "Support Team Shalva NY and help fund life-changing care — one step, one donation at a time.",
      imageConcept: "Split image: runner mid-stride on left, smiling Shalva program participant on right, connected by a subtle route line.",
      assetStudioPrompt: "Split-frame composition: marathon runner mid-stride on the left, a smiling child on the right, connected by a dotted route line, warm sand and teal palette, 1200x628 landscape",
      rationale: "Tests a personal/emotional narrative angle against the current fact-led copy, in your best-performing landscape format.",
    },
  ],
};

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.content.map((c) => c.text || "").join("");
}

function buildPrompt(performance) {
  const context = {
    campaignGoal: process.env.CAMPAIGN_GOAL || performance.campaign.goal,
    landingPageUrl: process.env.LANDING_PAGE_URL || "",
    targetAudience: process.env.TARGET_AUDIENCE || "",
  };
  return `You are a performance-marketing creative analyst. Given this campaign context and asset-level performance data, do two things:

1. Write a short (3-5 sentence) plain-English feedback summary of what's working and what isn't across headlines, descriptions, and images. For each asset give a one-line verdict: "keep", "improve", or "pause".
2. Propose 2 new creative concepts (headline, description, an image concept description, and a detailed image-generation prompt suitable for an AI image tool) designed to beat the current best performer, grounded in the patterns you see in the data and matched to the campaign goal, landing page, and audience below.

Campaign goal: ${context.campaignGoal}
Landing page: ${context.landingPageUrl}
Target audience: ${context.targetAudience}

Asset performance (last 30 days):
${JSON.stringify(performance.assets, null, 2)}

Respond ONLY with valid JSON in this exact shape, no markdown fences:
{
  "feedback": "string",
  "assetInsights": [{"id": "string", "verdict": "keep|improve|pause", "note": "string"}],
  "newCreatives": [{"headline": "string", "description": "string", "imageConcept": "string", "assetStudioPrompt": "string", "rationale": "string"}]
}`;
}

async function analyzePerformance(performance) {
  const mock = String(process.env.MOCK_MODE).toLowerCase() === "true";
  if (mock || !process.env.ANTHROPIC_API_KEY) {
    return MOCK_ANALYSIS;
  }
  const raw = await callClaude(buildPrompt(performance));
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Could not parse analysis response as JSON: " + raw.slice(0, 500));
  }
}

module.exports = { analyzePerformance };
