// dom.js — DOM init + base UI helpers (safe)
// Ensures App.el exists BEFORE other modules use it.

(function () {
  window.App = window.App || {};

  function must(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing DOM element: #${id}`);
    return el;
  }

  function safeText(el, txt) {
    try {
      if (el) el.textContent = String(txt);
    } catch (_) {}
  }

  // Public UI fail (others can call)
  function uiFail(msg, err) {
    try { console.error(msg, err || ""); } catch (_) {}

    // Try to show in debugBox if exists
    try {
      const dbg = App.el && App.el.debugBox ? App.el.debugBox : document.getElementById("debugBox");
      if (dbg) {
        dbg.hidden = false;
        dbg.textContent = `${msg}\n${(err && err.message) ? err.message : (err || "")}`.trim();
        return;
      }
    } catch (_) {}

    // Fallback alert (iOS-friendly)
    try { alert(msg); } catch (_) {}
  }

  App.uiFail = App.uiFail || uiFail;
  window.uiFail = window.uiFail || uiFail; // for older code that calls window.uiFail

  App.dom = App.dom || {};

  App.dom.init = function initDom() {
    // If already initialized, reuse
    if (App.el && App.el._inited) return App.el;

    const el = {
      // Buttons & inputs
      cameraBtn: must("cameraBtn"),
      filesBtn: must("filesBtn"),
      cameraInput: must("cameraInput"),
      filesInput: must("filesInput"),

      // Carousel
      carouselWrap: must("carouselWrap"),
      carousel: must("carousel"),
      pagesCount: must("pagesCount"),
      pageIndex: must("pageIndex"),

      // Analyze + hints
      analyzeBtn: must("analyzeBtn"),
      zeroHint: must("zeroHint"),
      limitHint: must("limitHint"),

      // Progress
      progressBox: must("progressBox"),
      pLine1: must("pLine1"),
      pLine2: must("pLine2"),

      // Quality panel
      qualityPanel: must("qualityPanel"),
      qualityTitle: must("qualityTitle"),
      qualityText: must("qualityText"),
      showBadBtn: must("showBadBtn"),
      deleteCurrentBadBtn: must("deleteCurrentBadBtn"),
      deleteBadBtn: must("deleteBadBtn"),
      showWarnBtn: must("showWarnBtn"),
      qualityList: must("qualityList"),

      // Result
      resultBox: must("resultBox"),
      doneBanner: must("doneBanner"),
      resultTitle: must("resultTitle"),
      resultSupport: must("resultSupport"),
      resultDetails: must("resultDetails"),
      aboutText: must("aboutText"),

      // Optional debug (may not exist)
      debugBox: document.getElementById("debugBox") || null,

      _inited: true
    };

    App.el = el;

    // Base UI helpers used by other modules
    App.uiBase = App.uiBase || {};

    App.uiBase.setProgress = App.uiBase.setProgress || function setProgress(line1, line2) {
      safeText(el.pLine1, line1 || "");
      safeText(el.pLine2, line2 || "");
    };

    App.uiBase.showZeroHintIfNeeded = App.uiBase.showZeroHintIfNeeded || function showZeroHintIfNeeded() {
      // If state exists: use it; else fallback to carousel content
      const count = (App.state && Array.isArray(App.state.pages)) ? App.state.pages.length : 0;
      try { el.zeroHint.style.display = (count === 0) ? "block" : "none"; } catch (_) {}
    };

    App.uiBase.showLimitHint = App.uiBase.showLimitHint || function showLimitHint(show) {
      try { el.limitHint.style.display = show ? "block" : "none"; } catch (_) {}
    };

    App.uiBase.setLocked = App.uiBase.setLocked || function setLocked(v) {
      try {
        el.cameraBtn.disabled = !!v;
        el.filesBtn.disabled = !!v;
      } catch (_) {}

      try {
        // analyze button is additionally controlled by other modules; here only basic lock
        if (v) el.analyzeBtn.disabled = true;
      } catch (_) {}
    };

    App.uiBase.resetUiAfterDataChange = App.uiBase.resetUiAfterDataChange || function resetUiAfterDataChange() {
      // Hide panels that depend on content; other modules will re-render
      try { el.resultBox.style.display = "none"; } catch (_) {}
      try { el.progressBox.style.display = "none"; } catch (_) {}
    };

    return el;
  };

  // Auto-init ASAP (prevents "Not ready: App.el")
  function boot() {
    try {
      App.dom.init();
      // optional: initial hints
      try { App.uiBase.showZeroHintIfNeeded(); } catch (_) {}
    } catch (e) {
      uiFail("Ошибка инициализации DOM. Проверь index.html (id элементов) и порядок скриптов.", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
