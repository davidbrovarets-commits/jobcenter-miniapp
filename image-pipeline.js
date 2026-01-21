// image-pipeline.js — safe & modular
(function () {
  "use strict";

  // ---------------------------
  // Namespace safety
  // ---------------------------
  window.App = window.App || {};
  App.images = App.images || {};
  App.state = App.state || {};
  App.state.pages = App.state.pages || [];

  App.uiBase = App.uiBase || {};
  App.uiCarousel = App.uiCarousel || {};
  App.uiQuality = App.uiQuality || {};
  App.stateApi = App.stateApi || {};

  // ---------------------------
  // Helpers
  // ---------------------------
  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function safe(fn) {
    try { fn && fn(); } catch (_) {}
  }

  function requireEl() {
    if (!App.el) throw new Error("Not ready: App.el");
    return App.el;
  }

  // ---------------------------
  // Image helpers
  // ---------------------------
  async function loadImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("Image load failed"));
    });

    return { img, url };
  }

  async function renderJpeg(img, maxSide, quality) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const scale = Math.min(1, maxSide / Math.max(w, h));
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, nw, nh);

    return await new Promise(res =>
      canvas.toBlob(b => res(b), "image/jpeg", quality)
    );
  }

  async function createThumbAndOcr(file) {
    const { img, url } = await loadImage(file);
    try {
      const thumbBlob = await renderJpeg(img, 650, 0.75);
      const fastOcrBlob = await renderJpeg(img, 900, 0.78);
      const ocrBlob = await renderJpeg(img, 1600, 0.82);

      return {
        thumbUrl: URL.createObjectURL(thumbBlob),
        fastOcrBlob,
        ocrBlob
      };
    } finally {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  }

  // ---------------------------
  // Core: addFiles
  // ---------------------------
  async function addFiles(fileList, onAddedOne) {
    const el = requireEl();

    const files = Array.from(fileList || [])
      .filter(f => f && f.type && f.type.startsWith("image/"));

    if (!files.length) return;

    const MAX = App.config?.MAX_PAGES || 15;
    const free = MAX - App.state.pages.length;
    if (free <= 0) {
      safe(() => App.uiBase.showLimitHint(true));
      return;
    }

    const slice = files.slice(0, free);
    safe(() => App.uiBase.showLimitHint(files.length > free));
    safe(() => App.uiBase.resetUiAfterDataChange());

    for (const f of slice) {
      const { thumbUrl, fastOcrBlob, ocrBlob } =
        await createThumbAndOcr(f);

      App.state.pages.push({
        id: App.stateApi.uid ? App.stateApi.uid() : uid(),
        thumbUrl,
        fastOcrBlob,
        ocrBlob,
        status: "ok",
        reason: "",
        ocrText: "",
        ocrConfidence: null,
        metrics: {}
      });

      if (typeof onAddedOne === "function") onAddedOne();
    }

    // clear inputs (important for iOS)
    if (el.cameraInput) el.cameraInput.value = "";
    if (el.filesInput) el.filesInput.value = "";

    // UI refresh
    safe(() => App.uiCarousel.renderCarousel());
    safe(() => App.uiQuality.updateQualityPanel());
    safe(() => App.uiBase.showZeroHintIfNeeded());
  }

  // ---------------------------
  // Exports
  // ---------------------------
  App.images.addFiles = addFiles;
  window.addFiles = addFiles;

})();
