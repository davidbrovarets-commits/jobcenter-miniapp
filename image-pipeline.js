// image-pipeline.js
// Image intake + preprocessing (thumb / fast OCR / main OCR) + inkRatio precheck utilities
// Exposes: App.images.addFiles(), App.images.estimateInkRatio()
// Also exports window.addFiles(files) for safe usage from main.js

(function () {
  "use strict";

  // Ensure App namespace
  const App = (window.App = window.App || {});

  // Ensure sub-namespaces
  App.images = App.images || {};

  // ---------- Small utils ----------
  function ensureConfig() {
    if (!App.config) App.config = {};

    // fallback defaults (если config.js не успел/не существует)
    if (typeof App.config.MAX_PAGES !== "number") App.config.MAX_PAGES = 15;

    if (typeof App.config.THUMB_MAX_SIDE !== "number") App.config.THUMB_MAX_SIDE = 650;
    if (typeof App.config.FAST_OCR_MAX_SIDE !== "number") App.config.FAST_OCR_MAX_SIDE = 900;
    if (typeof App.config.OCR_MAX_SIDE !== "number") App.config.OCR_MAX_SIDE = 1600;

    if (typeof App.config.THUMB_JPEG_Q !== "number") App.config.THUMB_JPEG_Q = 0.75;
    if (typeof App.config.FAST_OCR_JPEG_Q !== "number") App.config.FAST_OCR_JPEG_Q = 0.78;
    if (typeof App.config.OCR_JPEG_Q !== "number") App.config.OCR_JPEG_Q = 0.82;

    if (typeof App.config.INK_RATIO_MAX_SIDE !== "number") App.config.INK_RATIO_MAX_SIDE = 220;
    if (typeof App.config.INK_LUM_THRESHOLD !== "number") App.config.INK_LUM_THRESHOLD = 0.92; // lum < 0.92 => ink
  }

  function ensureState() {
    App.state = App.state || {};
    App.state.pages = App.state.pages || [];
    App.stateApi = App.stateApi || {};
    if (typeof App.stateApi.uid !== "function") {
      App.stateApi.uid = () =>
        Math.random().toString(16).slice(2) + Date.now().toString(16);
    }
  }

  function safeCall(fn, ...args) {
    try {
      if (typeof fn === "function") return fn(...args);
    } catch (_) {}
  }

  function isImageFile(f) {
    return !!(f && f.type && f.type.startsWith("image/"));
  }

  // ---------- Image loading ----------
  async function loadImageFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Image load failed"));
      });
      return { img, url };
    } catch (e) {
      try { URL.revokeObjectURL(url); } catch (_) {}
      throw e;
    }
  }

  async function canvasToJpegBlob(canvas, quality) {
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
    if (!blob) throw new Error("toBlob failed");
    return blob;
  }

  async function renderJpegBlob(img, maxSide, quality) {
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

    return await canvasToJpegBlob(canvas, quality);
  }

  // thumb + blobs for OCR
  async function createThumbAndOcr(file) {
    ensureConfig();

    const { img, url } = await loadImageFromFile(file);
    try {
      const thumbBlob = await renderJpegBlob(
        img,
        App.config.THUMB_MAX_SIDE,
        App.config.THUMB_JPEG_Q
      );

      const fastOcrBlob = await renderJpegBlob(
        img,
        App.config.FAST_OCR_MAX_SIDE,
        App.config.FAST_OCR_JPEG_Q
      );

      const ocrBlob = await renderJpegBlob(
        img,
        App.config.OCR_MAX_SIDE,
        App.config.OCR_JPEG_Q
      );

      const thumbUrl = URL.createObjectURL(thumbBlob);
      return { thumbUrl, fastOcrBlob, ocrBlob };
    } finally {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  }

  // ---------- Ink ratio precheck (no OCR) ----------
  async function estimateInkRatio(blob) {
    ensureConfig();

    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;

      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("img load failed"));
      });

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const maxSide = App.config.INK_RATIO_MAX_SIDE;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      const nw = Math.max(1, Math.round(w * scale));
      const nh = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, nw, nh);

      const data = ctx.getImageData(0, 0, nw, nh).data;

      let ink = 0;
      const total = nw * nh;
      const thr = App.config.INK_LUM_THRESHOLD;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; // 0..1
        if (lum < thr) ink++;
      }

      return ink / Math.max(1, total);
    } finally {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  }

  // ---------- Main intake ----------
  async function addFiles(fileList, opts) {
    ensureConfig();
    ensureState();

    const onAddedOne = opts && typeof opts.onAddedOne === "function" ? opts.onAddedOne : null;

    const arr = Array.from(fileList || []).filter(isImageFile);
    if (!arr.length) return 0;

    const pages = App.state.pages;

    const free = App.config.MAX_PAGES - pages.length;
    if (free <= 0) {
      safeCall(App.uiBase && App.uiBase.showLimitHint, true);
      return 0;
    }

    const slice = arr.slice(0, free);
    safeCall(App.uiBase && App.uiBase.showLimitHint, arr.length > free);

    // Сбрасываем UI результата/прогресса (если такие функции есть)
    safeCall(App.uiBase && App.uiBase.resetUiAfterDataChange);

    let added = 0;

    for (const f of slice) {
      const { thumbUrl, fastOcrBlob, ocrBlob } = await createThumbAndOcr(f);

      pages.push({
        id: App.stateApi.uid(),
        thumbUrl,
        fastOcrBlob,
        ocrBlob,
        status: "ok",
        reason: "",
        ocrText: "",
        ocrConfidence: null,
        metrics: {} // сюда later кладём inkRatio и т.п.
      });

      added++;
      if (onAddedOne) {
        try { onAddedOne(); } catch (_) {}
      }
    }

    // очистка инпутов (важно для повторного выбора того же файла)
    try { if (App.el && App.el.cameraInput) App.el.cameraInput.value = ""; } catch (_) {}
    try { if (App.el && App.el.filesInput) App.el.filesInput.value = ""; } catch (_) {}

    // обновление UI
    safeCall(App.uiCarousel && App.uiCarousel.renderCarousel);
    safeCall(App.uiQuality && App.uiQuality.updateQualityPanel);
    safeCall(App.uiBase && App.uiBase.showZeroHintIfNeeded);

    return added;
  }

  // ---------- Public API ----------
  App.images.createThumbAndOcr = createThumbAndOcr;
  App.images.estimateInkRatio = estimateInkRatio;
  App.images.addFiles = addFiles;

  // ---------- Exports for main.js (SAFE) ----------
  window.addFiles = (files, opts) => App.images.addFiles(files, opts);
})();
