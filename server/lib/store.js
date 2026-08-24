const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "suggestions.json");

function readAll() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(suggestions) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(suggestions, null, 2));
}

function saveSuggestions(newOnes) {
  const all = readAll();
  const withIds = newOnes.map((s, i) => ({
    id: `${Date.now()}-${i}`,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...s,
  }));
  writeAll([...withIds, ...all]);
  return withIds;
}

function setStatus(id, status) {
  const all = readAll();
  const item = all.find((s) => s.id === id);
  if (!item) return null;
  item.status = status;
  item.decidedAt = new Date().toISOString();
  writeAll(all);
  return item;
}

function getById(id) {
  return readAll().find((s) => s.id === id) || null;
}

function updateSuggestion(id, patch) {
  const all = readAll();
  const item = all.find((s) => s.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  writeAll(all);
  return item;
}

module.exports = { readAll, saveSuggestions, setStatus, getById, updateSuggestion };
