// ocr.js
window.App = window.App || {};

App.ocr = {
  cleanOcrText(t) {
    let s = (t || "");
    s = s.replace(/[^\S\r\n]+/g, " ");
    s = s.replace(/\n{3,}/g, "\n\n");
    s = s.replace(/[|}{]{2,}/g, " ");
    s = s.replace(/[^\p{L}\p{N}\s.,:;!?()+\-\/€$@%]/gu, "");
    s = s.replace(/\s{2,}/g, " ").trim();
    return s;
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
        const lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255; // 0..1
        if (lum < 0.92) ink++;
      }

      return ink / Math.max(1, total);
    } finally {
      try { URL.revokeObjectURL(url); } catch(_) {}
    }
  },

  evaluatePageQuality(text, confidence) {
    const t = text || "";
    const textLen = t.length;

    const ns = t.replace(/\s+/g, "");
    const total = Math.max(1, ns.length);
    const alphaNum = (ns.match(/[A-Za-zА-Яа-я0-9ÄÖÜäöüß]/g) || []).length;
    const alphaNumRatio = alphaNum / total;

    const low = App.stateApi.normalize(t);

    const keyPatterns = [
      "termin","einladung","frist","bis zum","spätestens",
      "bitte","wir bitten","sie werden gebeten",
      "unterlagen","nachweis","nachweisen","einreichen","vorlegen","mitwirkung",
      "anhörung","aufforderung","fehlende unterlagen","formular","ausfüllen",
      "summe","euro","leistungen","regelbedarf","mehrbedarf","bedarf",
      "kundennummer","aktenzeichen","bedarfsgemeinschaft","bg-nummer",
      "jobcenter","bürgergeld","bescheid","änderungsbescheid"
    ];

    const hasKeySignals = keyPatterns.some(k => low.includes(k));

    const conf = (confidence !== null && typeof confidence === "number") ? confidence : null;
    const confBad = (conf !== null && conf < 50);
    const ratioBad = (alphaNumRatio < 0.45);

    const tooShort = (textLen < 80);
    const veryShort = (textLen < 35);

    if (veryShort && (confBad || ratioBad) && !hasKeySignals) {
      return { status: "bad", reason: "Обнаружена плохо читаемая страница. Рекомендуем заменить для точного результата." };
    }

    if ((confBad || ratioBad) && !hasKeySignals) {
      return { status: "bad", reason: "Обнаружена плохо читаемая страница. Рекомендуем заменить для точного результата." };
    }

    if (tooShort) {
      return { status: "warn", reason: "Текста немного. Анализ возможен, но для точности лучше переснять страницу ближе к тексту." };
    }

    return { status: "ok", reason: "" };
  },

  async getWorker(lang) {
    const cfg = App.cfg;

    const setProgress = (l1, l2) => {
      App.el.pLine1.textContent = l1;
      App.el.pLine2.textContent = l2;
    };

    if (!App.state.ocrWorker) {
      setProgress("Анализ идёт", "Запускаем OCR");

      App.state.ocrWorker = await Tesseract.createWorker(lang, 1, {
        logger: (m) => {
          const pct = (typeof m.progress === "number") ? Math.round(m.progress * 100) : null;
          setProgress("Анализ идёт", (pct !== null) ? `${m.status}: ${pct}%` : `${m.status}`);
        },
        workerPath: cfg.TESS_WORKER_PATH,
        corePath: cfg.TESS_CORE_PATH,
        langPath: cfg.TESS_LANG_PATH
      });

      App.state.ocrLangInited = lang;
      return App.state.ocrWorker;
    }

    if (App.state.ocrLangInited === lang) return App.state.ocrWorker;

    setProgress("Анализ идёт", "Переключаем язык OCR");
    await App.state.ocrWorker.loadLanguage(lang);
    await App.state.ocrWorker.initialize(lang);
    App.state.ocrLangInited = lang;

    return App.state.ocrWorker;
  },

  async closeWorker() {
    if (!App.state.ocrWorker) return;
    try { await App.state.ocrWorker.terminate(); } catch(_) {}
    App.state.ocrWorker = null;
    App.state.ocrLangInited = null;
  },

  async ocrOnePage(pageObj, idx, total) {
    const cfg = App.cfg;

    App.el.pLine1.textContent = "Анализ идёт";
    App.el.pLine2.textContent = "Обрабатываем страницы: " + (idx + 1) + " из " + total;

    // 1) precheck ink ratio
    let inkRatio = 0;
    try {
      inkRatio = await App.ocr.estimateInkRatio(pageObj.fastOcrBlob || pageObj.ocrBlob);
    } catch(_) {
      inkRatio = 0.02;
    }
    pageObj.metrics = Object.assign({}, pageObj.metrics, { inkRatio });

    // 2) very blank -> micro OCR
    if (inkRatio <= cfg.INK_VERY_LOW) {
      const w = await App.ocr.getWorker(cfg.OCR_LANG_FAST);
      const r = await w.recognize(pageObj.fastOcrBlob || pageObj.ocrBlob);

      const rawText = r?.data?.text || "";
      const cleaned = App.ocr.cleanOcrText(rawText);
      const conf = (typeof r?.data?.confidence === "number") ? r.data.confidence : null;

      pageObj.ocrText = cleaned;
      pageObj.ocrConfidence = conf;

      const t = App.stateApi.normalize(cleaned);
      if (t.length < 20) {
        pageObj.status = "warn";
        pageObj.reason = "Страница почти пустая. Анализ возможен. Если на листе есть важные 1–2 строки, переснимите ближе к тексту.";
        return;
      }

      const q = App.ocr.evaluatePageQuality(cleaned, conf);
      pageObj.status = q.status;
      pageObj.reason = q.reason || "";
      return;
    }

    // 3) normal OCR (fast)
    let w = await App.ocr.getWorker(cfg.OCR_LANG_FAST);
    const r1 = await w.recognize((inkRatio <= cfg.INK_LOW) ? (pageObj.fastOcrBlob || pageObj.ocrBlob) : pageObj.ocrBlob);

    const rawText1 = r1?.data?.text || "";
    let cleaned = App.ocr.cleanOcrText(rawText1);
    let conf = (typeof r1?.data?.confidence === "number") ? r1.data.confidence : null;

    // 4) if Cyrillic found -> rerun full langs
    const hasCyr = /[А-Яа-яЁёІіЇїЄє]/.test(cleaned);
    if (hasCyr) {
      w = await App.ocr.getWorker(cfg.OCR_LANG_FULL);
      const r2 = await w.recognize(pageObj.ocrBlob);

      const rawText2 = r2?.data?.text || "";
      cleaned = App.ocr.cleanOcrText(rawText2);
      conf = (typeof r2?.data?.confidence === "number") ? r2.data.confidence : conf;
    }

    pageObj.ocrText = cleaned;
    pageObj.ocrConfidence = conf;

    const q = App.ocr.evaluatePageQuality(cleaned, conf);
    pageObj.status = q.status;
    pageObj.reason = q.reason || "";
  }
};
