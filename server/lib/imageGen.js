const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "public", "generated");

// Pollinations.ai: free, no API key, no signup. Generates an image from a
// text prompt over a plain HTTPS GET. Good enough for a few creatives a
// week; swap this function out for another provider's API if you outgrow it.
async function generateImage({ prompt, id, width = 1200, height = 628 }) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Image generation failed (${res.status}) for prompt: ${prompt.slice(0, 80)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `${id}.jpg`;
  fs.writeFileSync(path.join(OUT_DIR, filename), buffer);
  return `/generated/${filename}`;
}

module.exports = { generateImage };
