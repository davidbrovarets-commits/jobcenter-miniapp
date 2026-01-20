// image-pipeline.js
window.App = window.App || {};

App.images = {
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
      const c = App.config;
      const thumbBlob   = await App.images.renderJpegBlob(img, c.THUMB_MAX, c.THUMB_Q);
      const fastOcrBlob = await App.images.renderJpegBlob(img, c.FAST_OCR_MAX, c.FAST_Q);
      const ocrBlob     = await App.images.renderJpegBlob(img, c.OCR_MAX, c.OCR_Q);

      const thumbUrl = URL.createObjectURL(thumbBlob);
      return { thumbUrl, fastOcrBlob, ocrBlob };
    } finally {
      try { URL.revokeObjectURL(url); } catch(_) {}
    }
  },

  async estimateInkRatio(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("img load failed"));
      });

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const maxSide = 220;
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

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
        if (lum < 0.92) ink++;
      }

      return ink / Math.max(1, total);
    } finally {
      try { URL.revokeObjectURL(url); } catch(_) {}
    }
  },

  async addFiles(fileList, onAddedOne) {
    const arr = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith("image/"));
    if (!arr.length) return;

    const free = App.config.MAX_PAGES - App.state.pages.length;
    if (free <= 0) {
      App.uiBase.showLimitHint(true);
      return;
    }

    const slice = arr.slice(0, free);
    App.uiBase.showLimitHint(arr.length > free);

    App.uiBase.resetUiAfterDataChange();

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

      if (onAddedOne) onAddedOne();
    }

    App.el.cameraInput.value = "";
    App.el.filesInput.value = "";
  }
};

