// config.js
window.App = window.App || {};

App.cfg = {
  // Limits
  MAX_PAGES: 15,

  // OCR langs
  OCR_LANG_FAST: "deu",
  OCR_LANG_FULL: "deu+rus",

  // Tesseract explicit paths (more stable on Telegram iOS)
  TESS_WORKER_PATH: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
  TESS_CORE_PATH: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js",
  TESS_LANG_PATH: "https://tessdata.projectnaptha.com/4.0.0",

  // Smart blank thresholds (conservative)
  INK_VERY_LOW: 0.005, // 0.5%
  INK_LOW: 0.012,      // 1.2%

  // Image pipeline sizes
  THUMB_MAX: 650,
  FAST_OCR_MAX: 900,
  OCR_MAX: 1600,

  // JPEG qualities
  THUMB_Q: 0.75,
  FAST_OCR_Q: 0.78,
  OCR_Q: 0.82
};
