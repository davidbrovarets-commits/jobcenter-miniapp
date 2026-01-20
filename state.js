// state.js
window.App = window.App || {};

App.state = {
  // page: { id, thumbUrl, ocrBlob, fastOcrBlob, status:'ok'|'warn'|'bad', reason:'', ocrText:'', ocrConfidence:null, metrics:{} }
  pages: [],
  isLocked: false,

  // OCR
  ocrWorker: null,
  ocrLangInited: null
};

App.stateApi = {
  uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  },

  normalize(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  },

  nextFrame() {
    return new Promise(r => requestAnimationFrame(() => r()));
  },

  hasBadPages() {
    return App.state.pages.some(p => p.status === "bad");
  },

  badIndexes() {
    return App.state.pages.map((p,i) => p.status === "bad" ? (i+1) : null).filter(Boolean);
  },

  warnIndexes() {
    return App.state.pages.map((p,i) => p.status === "warn" ? (i+1) : null).filter(Boolean);
  },

  firstBadIndex() {
    return App.state.pages.findIndex(p => p.status === "bad");
  },

  firstWarnIndex() {
    return App.state.pages.findIndex(p => p.status === "warn");
  }
};

