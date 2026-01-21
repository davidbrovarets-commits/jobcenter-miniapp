// image-pipeline.js
window.App = window.App || {};

App.images = {
  // Remove page by id
  removePage(id) {
    const pages = App.state.pages;
    const i = pages.findIndex(p => p.id === id);
    if (i >= 0) {
      try { URL.revokeObjectURL(pages[i].thumbUrl); } catch(_) {}
      pages.splice(i, 1);
    }

    // reset result/progress
    App.el.resultBox.style.display = "none";
    App.el.progressBox.style.display = "none";
    App.qualityUi.showLimitHint(false);

    // re-render
    App.carouselUi.renderCarousel();
    App.qualityUi.updateQualityPanel();
    App.qualityUi.showZeroHintIfNeeded();
  },

  async loadImageFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Image load failed"));
      });
      return { img, url };
    } catch (e) {
      try { URL.revokeObjectURL(url); } catch(_) {}
      throw e;
    }
  },

  async renderJpegBlob(img, maxSide, quality) {
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
  },

  async createThumbAndOcr(file) {
    const { img, url } = await App.images.loadImageFromFile(file);
    try {
      const c = App.cfg;

      const thumbBlob   = await App.images.renderJpegBlob(img, c.THUMB_MAX, c.THUMB_Q);
      const fastOcrBlob = await App.images.renderJpegBlob(img, c.FAST_OCR_MAX, c.FAST_OCR_Q);
      const ocrBlob     = await App.images.renderJpegBlob(img, c.OCR_MAX, c.OCR_Q);

      const thumbUrl = URL.createObjectURL(thumbBlob);
      return { thumbUrl, fastOcrBlob, ocrBlob };
    } finally {
      try { URL.revokeObjectURL(url); } catch(_) {}
    }
  },

  async addFiles(fileList) {
    // IMPORTANT: do not touch App.el at module load time. Only here.
    const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith("image/"));
    if (!files.length) return;

    const free = App.cfg.MAX_PAGES - App.state.pages.length;
    if (free <= 0) {
      App.qualityUi.showLimitHint(true);
      return;
    }

    const slice = files.slice(0, free);
    App.qualityUi.showLimitHint(files.length > free);

    // hide result/progress on new input
    App.el.resultBox.style.display = "none";
    App.el.progressBox.style.display = "none";

    // add sequentially (safer on iOS)
    for (const f of slice) {
      const { thumbUrl, fastOcrBlob, ocrBlob } = await App.images.createThumbAndOcr(f);

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

      // render each time to ensure user sees immediately
      App.carouselUi.renderCarousel();
      App.qualityUi.updateQualityPanel();
      App.qualityUi.showZeroHintIfNeeded();

      await App.stateApi.nextFrame();
    }
  }
};

// Backward compatibility (if some old code calls window.addFiles)
window.addFiles = (files) => App.images.addFiles(files);
