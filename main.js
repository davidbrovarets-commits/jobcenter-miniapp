// main.js — orchestrator (robust)

// 1) Telegram init (safe)
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { if (tg) { tg.ready(); tg.expand(); } } catch (_) {}

// 2) Helpers
function mustDom(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element: #${id}`);
  return el;
}

function uiError(msg, err) {
  console.error(msg, err || "");

  // Prefer your UI fail if present
  try {
    if (window.App && App.uiBase && typeof App.uiBase.uiFail === "function") {
      return App.uiBase.uiFail(msg, err);
    }
    if (typeof window.uiFail === "function") {
      return window.uiFail(msg, err);
    }
  } catch (_) {}

  // Fallback
  alert(msg + (err && err.message ? `\n\n${err.message}` : ""));
}

function getAddFilesFn() {
  if (typeof window.addFiles === "function") return window.addFiles;
  if (window.ImagePipeline && typeof window.ImagePipeline.addFiles === "function") return window.ImagePipeline.addFiles;
  if (window.imagePipeline && typeof window.imagePipeline.addFiles === "function") return window.imagePipeline.addFiles;
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForReady({ timeoutMs = 4000, stepMs = 50 } = {}) {
  const t0 = Date.now();

  while (Date.now() - t0 < timeoutMs) {
    const addFiles = getAddFilesFn();

    // We accept two valid states:
    // A) modular App exists and is ready + addFiles exists
    // B) only addFiles exists (legacy), but must not throw due to missing DOM
    const appOk =
      !!window.App &&
      !!App.config &&
      !!App.state &&
      !!App.stateApi &&
      !!App.el &&
      !!App.uiBase &&
      !!App.images;

    if (addFiles && (appOk || !window.App)) return true;

    await sleep(stepMs);
  }

  // If timeout, build detailed diagnostics
  const miss = [];
  if (!getAddFilesFn()) miss.push("addFiles()");
  if (!window.App) miss.push("window.App");
  else {
    if (!App.config) miss.push("App.config");
    if (!App.state) miss.push("App.state");
    if (!App.stateApi) miss.push("App.stateApi");
    if (!App.el) miss.push("App.el");
    if (!App.uiBase) miss.push("App.uiBase");
    if (!App.images) miss.push("App.images");
  }

  throw new Error("Not ready: " + (miss.length ? miss.join(", ") : "unknown"));
}

// 3) DOM (hard requirements for main)
const cameraBtn   = mustDom("cameraBtn");
const filesBtn    = mustDom("filesBtn");
const cameraInput = mustDom("cameraInput");
const filesInput  = mustDom("filesInput");
const carousel    = mustDom("carousel");
const analyzeBtn  = mustDom("analyzeBtn");

// lock controls until ready
cameraBtn.disabled = true;
filesBtn.disabled = true;

// 4) Init
(async function boot() {
  try {
    await waitForReady({ timeoutMs: 6000, stepMs: 60 });

    cameraBtn.disabled = false;
    filesBtn.disabled = false;

    // Optional: call UI refresh hooks if exist
    try { if (typeof window.renderCarousel === "function") window.renderCarousel(); } catch (_) {}
    try { if (typeof window.updateQualityPanel === "function") window.updateQualityPanel(); } catch (_) {}
    try { if (typeof window.showZeroHintIfNeeded === "function") window.showZeroHintIfNeeded(); } catch (_) {}

  } catch (e) {
    uiError("Ошибка инициализации. Проверь порядок подключаемых скриптов и наличие модулей.", e);
  }
})();

// 5) Bind events
cameraBtn.addEventListener("click", () => {
  try { cameraInput.click(); } catch (e) { uiError("Не удалось открыть камеру.", e); }
});

filesBtn.addEventListener("click", () => {
  try { filesInput.click(); } catch (e) { uiError("Не удалось открыть выбор файлов.", e); }
});

cameraInput.addEventListener("change", async () => {
  try {
    const addFiles = getAddFilesFn();
    if (!addFiles) throw new Error("addFiles() is not available. Check image-pipeline.js export and script order.");
    await addFiles(cameraInput.files);
  } catch (e) {
    uiError("Ошибка: не удалось добавить фото. (addFiles)", e);
  } finally {
    try { cameraInput.value = ""; } catch (_) {}
  }
});

filesInput.addEventListener("change", async () => {
  try {
    const addFiles = getAddFilesFn();
    if (!addFiles) throw new Error("addFiles() is not available. Check image-pipeline.js export and script order.");
    await addFiles(filesInput.files);
  } catch (e) {
    uiError("Ошибка: не удалось добавить файлы. (addFiles)", e);
  } finally {
    try { filesInput.value = ""; } catch (_) {}
  }
});

// carousel scroll -> counters (if module exposes it)
carousel.addEventListener("scroll", () => {
  try { if (typeof window.updateCounters === "function") window.updateCounters(); } catch (_) {}
});

// analysis click (delegate)
analyzeBtn.addEventListener("click", async () => {
  try {
    if (typeof window.runAnalysis === "function") {
      await window.runAnalysis();
      return;
    }
  } catch (e) {
    uiError("Ошибка анализа.", e);
  }
});
