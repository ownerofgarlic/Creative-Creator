const scanBtn = document.getElementById("scanBtn");
const modeBadge = document.getElementById("modeBadge");
const scanStatus = document.getElementById("scanStatus");
const errorEl = document.getElementById("error");
const feedbackSection = document.getElementById("feedbackSection");
const feedbackText = document.getElementById("feedbackText");
const assetsSection = document.getElementById("assetsSection");
const assetsTableBody = document.querySelector("#assetsTable tbody");
const creativeGrid = document.getElementById("creativeGrid");
const emptyState = document.getElementById("emptyState");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

function clearError() {
  errorEl.style.display = "none";
}

function pct(n) {
  return (n * 100).toFixed(2) + "%";
}

function renderAssets(assets, insightsById) {
  assetsTableBody.innerHTML = "";
  assets.forEach((a) => {
    const insight = insightsById[a.id];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.type}</td>
      <td>${a.text}</td>
      <td>${a.impressions}</td>
      <td>${a.clicks}</td>
      <td>${pct(a.ctr)}</td>
      <td>${a.conversions}</td>
      <td>${insight ? `<span class="verdict ${insight.verdict}">${insight.verdict}</span><br><span style="color:var(--muted);font-weight:400;text-transform:none">${insight.note}</span>` : ""}</td>
    `;
    assetsTableBody.appendChild(tr);
  });
  assetsSection.style.display = assets.length ? "block" : "none";
}

function creativeCard(s) {
  const div = document.createElement("div");
  div.className = "creative-card";
  div.dataset.id = s.id;
  const statusHtml =
    s.status && s.status !== "pending"
      ? `<span class="status-pill ${s.status}">${s.status}</span>`
      : "";
  const imageHtml = s.imageUrl
    ? `<img class="creative-img" src="${s.imageUrl}" alt="${s.headline}" />`
    : `<p class="concept">${s.imageError ? "(image generation failed: " + s.imageError + ")" : s.imageConcept || ""}</p>`;
  div.innerHTML = `
    ${statusHtml}
    ${imageHtml}
    <h3>${s.headline}</h3>
    <p>${s.description}</p>
    <p class="rationale">${s.rationale || ""}</p>
    ${
      s.status === "pending" || !s.status
        ? `<div class="decision-row">
            <button class="approve" data-decision="approved">Approve</button>
            <button class="decline" data-decision="declined">Decline</button>
          </div>`
        : ""
    }
  `;
  div.querySelectorAll("button[data-decision]").forEach((btn) => {
    btn.addEventListener("click", () => decide(s.id, btn.dataset.decision));
  });
  return div;
}

function renderSuggestions(list) {
  creativeGrid.innerHTML = "";
  emptyState.style.display = list.length ? "none" : "block";
  list.forEach((s) => creativeGrid.appendChild(creativeCard(s)));
}

async function decide(id, decision) {
  try {
    const res = await fetch(`/api/suggestions/${id}/${decision}`, { method: "POST" });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
    await loadSuggestions();
  } catch (err) {
    showError(err.message);
  }
}

async function loadSuggestions() {
  const res = await fetch("/api/suggestions");
  const list = await res.json();
  renderSuggestions(list);
}

async function scanNow() {
  clearError();
  scanBtn.disabled = true;
  scanStatus.textContent = "Scanning campaign and analyzing creatives…";
  try {
    const res = await fetch("/api/scan", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Scan failed");

    modeBadge.textContent = data.source === "mock" ? "Mock data mode" : "Live Google Ads data";
    scanStatus.textContent = "Last scan: " + new Date().toLocaleString();

    feedbackText.textContent = data.feedback;
    feedbackSection.style.display = "block";

    const insightsById = {};
    (data.assetInsights || []).forEach((i) => (insightsById[i.id] = i));
    renderAssets(data.assets, insightsById);

    await loadSuggestions();
  } catch (err) {
    showError(err.message);
    scanStatus.textContent = "";
  } finally {
    scanBtn.disabled = false;
  }
}

scanBtn.addEventListener("click", scanNow);
loadSuggestions();
