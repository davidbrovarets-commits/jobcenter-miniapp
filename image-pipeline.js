/* image-pipeline.js
   - image load + resize -> blobs
   - addFiles pipeline (camera/files inputs)
   - exports window.addFiles for main.js compatibility
*/

(function () {
  // Ensure App namespace
  window.App = window.App || {};
  const App = window.App;

  App.images = App.images || {};

  // ---------------- Guards ----------------
  function must(name, v) {
    if (!v) throw new Error(`Missing dependency: ${name}`);
    return v;
  }

  // ---------------- Utils ----------------
  function safeRevoke(url) {
    try { URL.revokeObjectURL(url); } catch (_) {}
  }

  // ---------------- Image load ----------------
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
      safeRevoke(url);
      throw e;
    }
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

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) throw new Error("toBlob failed");
    return blob;
  }

  // Create: thumbUrl + blobs for OCR
  async function createThumbAndOcr(file) {
    const { img, url } = await loadImageFromFile(file);
    try {
      // Values can be taken from config if you later move them there
      const thumbBlob   = await renderJpegBlob(img, 650, 0.75);
      const fastOcrBlob = await renderJpegBlob(img, 900, 0.78);
      const ocrBlob     = await renderJpegBlob(img, 1600, 0.82);

      const thumbUrl = URL.createObjectURL(thumbBlob);
      return { thumbUrl, fastOcrBlob, ocrBlob };
    } finally {
      safeRevoke(url);
    }
  }

  App.images.createThumbAndOcr = createThumbAndOcr;

  // ---------------- addFiles pipeline ----------------
  async function addFiles(fileList, onAddedOne) {
    // dependencies
    must("App.config", App.config);
    must("App.state", App.state);
    must("App.el", App.el);
    must("App.uiBase", App.uiBase);
    must("App.uiCarousel", App.uiCarousel);
    must("App.uiQuality", App.uiQuality);

    const MAX_PAGES = App.config.MAX_PAGES;

    // only images
    const arr = Array.from(fileList || []).filter(
      (f) => f && f.type && f.type.startsWith("image/")
    );
    if (!arr.length) return;

    // limit
    const free = MAX_PAGES - App.state.pages.length;
    if (free <= 0) {
      App.uiBase.showLimitHint(true);
      return;
    }

    const slice = arr.slice(0, free);
    App.uiBase.showLimitHint(arr.length > free);

    // reset result/progress UI
    App.uiBase.resetUiAfterDataChange();

    // process sequentially (stable for iOS WebView)
    for (const f of slice) {
      const { thumbUrl, fastOcrBlob, ocrBlob } = await createThumbAndOcr(f);

      App.state.pages.push({
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

      if (typeof onAddedOne === "function") onAddedOne();
    }

    // clear inputs to allow re-pick same photo
    if (App.el.cameraInput) App.el.cameraInput.value = "";
    if (App.el.filesInput) App.el.filesInput.value = "";

    // re-render
    App.uiCarousel.renderCarousel();
    App.uiQuality.updateQualityPanel();
    App.uiBase.showZeroHintIfNeeded();
  }

  // Attach into modules
  App.images.addFiles = addFiles;

  // ---- EXPORTS (for main.js or older code expecting global) ----
  window.addFiles = addFiles;

})();
