// dom.js
window.App = window.App || {};

App.dom = {
  init() {
    const el = {
      // Buttons & inputs
      cameraBtn: document.getElementById("cameraBtn"),
      filesBtn: document.getElementById("filesBtn"),
      cameraInput: document.getElementById("cameraInput"),
      filesInput: document.getElementById("filesInput"),

      // Carousel
      carouselWrap: document.getElementById("carouselWrap"),
      carousel: document.getElementById("carousel"),
      pagesCount: document.getElementById("pagesCount"),
      pageIndex: document.getElementById("pageIndex"),

      // Analyze + hints
      analyzeBtn: document.getElementById("analyzeBtn"),
      zeroHint: document.getElementById("zeroHint"),
      limitHint: document.getElementById("limitHint"),

      // Progress
      progressBox: document.getElementById("progressBox"),
      pLine1: document.getElementById("pLine1"),
      pLine2: document.getElementById("pLine2"),

      // Quality
      qualityPanel: document.getElementById("qualityPanel"),
      qualityTitle: document.getElementById("qualityTitle"),
      qualityText: document.getElementById("qualityText"),
      showBadBtn: document.getElementById("showBadBtn"),
      deleteCurrentBadBtn: document.getElementById("deleteCurrentBadBtn"),
      deleteBadBtn: document.getElementById("deleteBadBtn"),
      showWarnBtn: document.getElementById("showWarnBtn"),
      qualityList: document.getElementById("qualityList"),

      // Result
      resultBox: document.getElementById("resultBox"),
      doneBanner: document.getElementById("doneBanner"),
      resultTitle: document.getElementById("resultTitle"),
      resultSupport: document.getElementById("resultSupport"),
      resultDetails: document.getElementById("resultDetails"),
      aboutText: document.getElementById("aboutText"),

      // Texts
      maxPagesText: document.getElementById("maxPagesText")
    };

    App.el = el;

    // Set MAX_PAGES text
    if (el.maxPagesText) el.maxPagesText.textContent = String(App.config.MAX_PAGES);
  }
};

App.uiBase = {
  escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  showLimitHint(v) {
    App.el.limitHint.style.display = v ? "block" : "none";
  },

  showZeroHintIfNeeded() {
    const pages = App.state.pages;
    App.el.zeroHint.style.display = (pages.length === 0) ? "block" : "none";
    App.el.analyzeBtn.disabled = App.state.isLocked || pages.length === 0 || App.stateApi.hasBadPages();
  },

  setLocked(v) {
    App.state.isLocked = v;

    const el = App.el;
    el.cameraBtn.disabled = v;
    el.filesBtn.disabled  = v;

    el.carousel.querySelectorAll("button[data-del]").forEach(btn => btn.disabled = v);

    el.showBadBtn.disabled = v;
    el.deleteCurrentBadBtn.disabled = v;
    el.deleteBadBtn.disabled = v;
    el.showWarnBtn.disabled = v;

    el.analyzeBtn.disabled = v || App.state.pages.length === 0 || App.stateApi.hasBadPages();
  },

  resetUiAfterDataChange() {
    App.el.resultBox.style.display = "none";
    App.el.progressBox.style.display = "none";
    App.uiBase.showLimitHint(false);
  }
};

