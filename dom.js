// dom.js
window.App = window.App || {};

App.dom = {
  init() {
    const byId = (id) => document.getElementById(id);

    const el = {
      // Labels/buttons & inputs
      cameraLabel: byId("cameraLabel"),
      filesLabel: byId("filesLabel"),
      cameraInput: byId("cameraInput"),
      filesInput: byId("filesInput"),

      maxPagesText: byId("maxPagesText"),

      // Carousel
      carouselWrap: byId("carouselWrap"),
      carousel: byId("carousel"),
      pagesCount: byId("pagesCount"),
      pageIndex: byId("pageIndex"),

      // Analyze + hints
      analyzeBtn: byId("analyzeBtn"),
      zeroHint: byId("zeroHint"),
      limitHint: byId("limitHint"),

      // Progress
      progressBox: byId("progressBox"),
      pLine1: byId("pLine1"),
      pLine2: byId("pLine2"),

      // Quality panel
      qualityPanel: byId("qualityPanel"),
      qualityTitle: byId("qualityTitle"),
      qualityText: byId("qualityText"),
      showBadBtn: byId("showBadBtn"),
      deleteCurrentBadBtn: byId("deleteCurrentBadBtn"),
      deleteBadBtn: byId("deleteBadBtn"),
      showWarnBtn: byId("showWarnBtn"),
      qualityList: byId("qualityList"),

      // Result
      resultBox: byId("resultBox"),
      doneBanner: byId("doneBanner"),
      resultTitle: byId("resultTitle"),
      resultSupport: byId("resultSupport"),
      resultDetails: byId("resultDetails"),
      aboutText: byId("aboutText")
    };

    // Required check (hard fail early)
    const required = [
      "cameraInput","filesInput",
      "carouselWrap","carousel","pagesCount","pageIndex",
      "analyzeBtn","zeroHint","limitHint",
      "progressBox","pLine1","pLine2",
      "qualityPanel","qualityTitle","qualityText",
      "showBadBtn","deleteCurrentBadBtn","deleteBadBtn","showWarnBtn","qualityList",
      "resultBox","doneBanner","resultTitle","resultSupport","resultDetails","aboutText",
      "maxPagesText"
    ];

    const missing = required.filter(k => !el[k]);
    if (missing.length) {
      throw new Error("Missing DOM elements: " + missing.join(", "));
    }

    App.el = el;

    // set max pages text
    try {
      App.el.maxPagesText.textContent = String(App.cfg.MAX_PAGES);
    } catch(_) {}

    // Provide consistent UI error handler (used by main.js)
    window.uiFail = function (msg, err) {
      console.error(msg, err || "");
      try { alert(msg); } catch(_) {}
    };

    return el;
  }
};
