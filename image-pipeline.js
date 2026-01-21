// image-pipeline.js — load images from <input>, make thumbs + OCR blobs (safe, iOS-friendly)

(function () {
  window.App = window.App || {};
  App.images = App.images || {};

  const cfg = App.config || {};

  const MAX_PAGES = Number(cfg.MAX_PAGES || 15);

  // Render sizes (conservative for iOS)
  const THUMB_MAX = Number(cfg.THUMB_MAX || 650);
  const FAST_OCR_MAX = Number(cfg.FAST_OCR_MAX || 900);
  const OCR_MAX = Number(cfg.OCR_MAX || 1600);

  const THUMB_Q = Number(cfg.THUMB_Q || 0.75);
  const FAST_Q = Number(cfg.FAST_Q || 0.78);
  const OCR_Q = Number(cfg.OCR_Q || 0.82);

  function uiFail(msg, err) {
    try {
      if (typeof App.uiFail === "function") return App.uiFail(msg, err);
    } catch (_) {}
    console.error(msg, err || "");
    try { alert(msg); } catch (_) {}
  }

  function ensureReady() {
    if (!App.el) throw new Error("Not ready: App.el");
    if (!App.state) App.state = {};
    if (!Array.isArray(App.state.pages)) App.state.pages = [];
    if (!App.stateApi) App.stateApi = {};
    if (typeof App.stateApi.uid !== "function") {
      App.stateApi.uid = function uid() {
        return Math.random().toString(16).slice(2) + Date.now().toString(16);
      };
    }
  }

  function isHeic(file) {
    const name = (file && file.name ? String(file.name) : "").toLowerCase();
    const type = (file && file.type ? String(file.type) : "").toLowerCase();
    return (
      type.includes("heic") ||
      type.includes("heif") ||
      name.endsWith(".heic") ||
      name.endsWith(".heif")
    );
  }

  async function loadImageFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Image load failed (unsupported format or decode error)"));
      });
      return { img, url };
    } catch (e) {
      try { URL.revokeObjectURL(url); } catch (_) {}
      throw e;
    }
  }

  async function renderJpegBlob(img, maxSide, quality) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // iOS safety
    if (!w || !h) throw new Error("Invalid image size");

    const scale = Math.min(1, maxSide / Math.max(w, h));
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;

    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
    ctx.drawImage(img, 0, 0, nw, nh);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) throw new Error("toBlob failed");
    return blob;
  }

  async function createThumbAndOcr(file) {
    const { img, url } = await loadImageFromFile(file);
    try {
      const thumbBlob = await renderJpegBlob(img, THUMB_MAX, THUMB_Q);
      const fastOcrBlob = await renderJpegBlob(img, FAST_OCR_MAX, FAST_Q);
      const ocrBlob = await renderJpegBlob(img, OCR_MAX, OCR_Q);

      const thumbUrl = URL.createObjectURL(thumbBlob);
      return { thumbUrl, fastOcrBlob, ocrBlob };
    } finally {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  }

  function rerenderAll() {
    try { if (App.uiCarousel && typeof App.uiCarousel.renderCarousel === "function") App.uiCarousel.renderCarousel(); } catch (_) {}
    try { if (App.uiQuality && typeof App.uiQuality.updateQualityPanel === "function") App.uiQuality.updateQualityPanel(); } catch (_) {}
    try { if (App.uiBase && typeof App.uiBase.showZeroHintIfNeeded === "function") App.uiBase.showZeroHintIfNeeded(); } catch (_) {}
  }

  async function addFiles(fileList, onAddedOne) {
    ensureReady();

    const pages = App.state.pages;

    const files = Array.from(fileList || []).filter(Boolean);

    if (!files.length) return;

    const free = MAX_PAGES - pages.length;
    if (free <= 0) {
      try { if (App.uiBase && typeof App.uiBase.showLimitHint === "function") App.uiBase.showLimitHint(true); } catch (_) {}
      return;
    }

    const slice = files.slice(0, free);
    try { if (App.uiBase && typeof App.uiBase.showLimitHint === "function") App.uiBase.showLimitHint(files.length > free); } catch (_) {}

    // Hide result/progress after adding new inputs
    try { if (App.uiBase && typeof App.uiBase.resetUiAfterDataChange === "function") App.uiBase.resetUiAfterDataChange(); } catch (_) {}

    let added = 0;

    for (const f of slice) {
      // Basic type check
      const type = (f.type || "").toLowerCase();
      const isImageLike = type.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f.name || "");
      if (!isImageLike) continue;

      // HEIC guard — most common причина “ничего не видно”
      if (isHeic(f)) {
        uiFail(
          "iPhone сохранил фото в HEIC/HEIF. Telegram Mini App может не распознать этот формат.\n" +
          "Решение: Settings → Camera → Formats → Most Compatible (JPEG).",
          null
        );
        continue;
      }

      try {
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
          metrics: {}
        });

        added++;
        if (typeof onAddedOne === "function") {
          try { onAddedOne(); } catch (_) {}
        }
      } catch (e) {
        // ВАЖНО: больше не “молчим”
        uiFail(
          "Не удалось добавить фото. Возможные причины: формат не поддерживается или ошибка декодирования.\n" +
          "Попробуй сделать фото без бликов и убедись, что формат JPEG (Most Compatible).",
          e
        );
      }
    }

    // clear inputs to allow re-pick same photo
    try { if (App.el.cameraInput) App.el.cameraInput.value = ""; } catch (_) {}
    try { if (App.el.filesInput) App.el.filesInput.value = ""; } catch (_) {}

    // Always rerender (even if 0 added → покажет подсказку)
    rerenderAll();

    // If ничего не добавилось — подсказать явно
    if (added === 0) {
      // Это поможет понять, что цикл отработал, но всё отфильтровалось/не декодировалось
      console.warn("[image-pipeline] 0 files added. Likely HEIC/unsupported or decode failure.");
    }
  }

  // Attach into modules
  App.images.addFiles = addFiles;

  // EXPORTS (for main.js or older code expecting global)
  window.addFiles = addFiles;

})();
