// ocr.js
window.App = window.App || {};

App.ocr = {
  async getWorker(lang) {
    const s = App.state;
    const c = App.config;

    if (!lang) lang = c.OCR_LANG_FAST;

    App.el.pLine1.textContent = "Анализ идёт";
    App.el.pLine2.textContent = "Подготовка OCR…";

    // Create once
    if (!s.ocrWorker) {
      // IMPORTANT: no logger here -> avoids DataCloneError on Telegram iOS
      s.ocrWorker = await Tesseract.createWorker({
        workerPath: c.TESS_WORKER_PATH,
        corePath: c.TESS_CORE_PATH,
        langPath: c.TESS_LANG_PATH
      });

      // Init default language
      await s.ocrWorker.loadLanguage(lang);
      await s.ocrWorker.initialize(lang);
      await s.ocrWorker.setParameters({ tessedit_pageseg_mode: "6" });

      s.ocrLangInited = lang;
      return s.ocrWorker;
    }

    // Same language
    if (s.ocrLangInited === lang) return s.ocrWorker;

    // Switch language (safe)
    App.el.pLine1.textContent = "Анализ идёт";
    App.el.pLine2.textContent = `OCR: переключаем язык (${lang})…`;

    await s.ocrWorker.loadLanguage(lang);
    await s.ocrWorker.initialize(lang);
    await s.ocrWorker.setParameters({ tessedit_pageseg_mode: "6" });

    s.ocrLangInited = lang;
    return s.ocrWorker;
  },

  async closeWorker() {
    const s = App.state;
    if (!s.ocrWorker) return;
    try { await s.ocrWorker.terminate(); } catch(_) {}
    s.ocrWorker = null;
    s.ocrLangInited = null;
  },

  cleanText(t) {
    let s = (t || "");
    s = s.replace(/[^\S\r\n]+/g, " ");
    s = s.replace(/\n{3,}/g, "\n\n");
    s = s.replace(/[|}{]{2,}/g, " ");
    s = s.replace(/[^\p{L}\p{N}\s.,:;!?()+\-\/€$@%]/gu, "");
    s = s.replace(/\s{2,}/g, " ").trim();
    return s;
  },

  evaluateQuality(text, confidence) {
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
      "kundennummer","aktenzeichen","bedarfsgemeinschaft","bg-nummer"
    ];

    const hasKeySignals = keyPatterns.some(k => low.includes(k));

    const conf = (confidence !== null && typeof confidence === "number") ? confidence : null;
    const confBad = (conf !== null && conf < 50);
    const confOk  = (conf === null || conf >= 55);

    const ratioBad = (alphaNumRatio < 0.45);
    const ratioOk  = (alphaNumRatio >= 0.55);

    const tooShort = (textLen < 80);
    const veryShort = (textLen < 35);

    if (veryShort && (confBad || ratioBad) && !hasKeySignals) {
      return { status: "bad", reason: "Обнаружена плохо читаемая страница. Рекомендуем заменить для точного результата." };
    }

    if (tooShort && confOk && ratioOk) {
      return { status: "warn", reason: "На странице мало текста. Анализ возможен. Для точности можно переснять ближе к тексту." };
    }

    if (tooShort && hasKeySignals && !confBad && !ratioBad) {
      return { status: "warn", reason: "Текст распознан частично, но найдены сигналы. Анализ возможен. Для точности лучше переснять страницу." };
    }

    if (confBad || ratioBad) {
      return { status: "bad", reason: "Обнаружена плохо читаемая страница. Рекомендуем заменить для точного результата." };
    }

    if (tooShort) {
      return { status: "warn", reason: "Текста немного. Анализ возможен. Для точности добавьте страницу со сроком или просьбой (Bitte / Frist / Termin), если она есть." };
    }

    return { status: "ok", reason: "" };
  },

  async ocrOnePage(pageObj, idx, total) {
    const c = App.config;

    App.el.pLine1.textContent = "Анализ идёт";
    App.el.pLine2.textContent = `Обрабатываем страницы: ${idx + 1} из ${total}`;

    // 1) precheck inkRatio
    let inkRatio = 0;
    try {
      inkRatio = await App.images.estimateInkRatio(pageObj.fastOcrBlob || pageObj.ocrBlob);
    } catch(_) {
      inkRatio = 0.02;
    }
    pageObj.metrics = Object.assign({}, pageObj.metrics, { inkRatio });

    // 2) VERY blank -> micro OCR
    if (inkRatio <= c.INK_VERY_LOW) {
      const worker = await App.ocr.getWorker(c.OCR_LANG_FAST);

      App.el.pLine2.textContent = `OCR (fast) — страница ${idx + 1}/${total}`;
      const r = await worker.recognize(pageObj.fastOcrBlob || pageObj.ocrBlob);

      const rawText = (r.data && r.data.text) ? r.data.text : "";
      const cleaned = App.ocr.cleanText(rawText);
      const conf = (r.data && typeof r.data.confidence === "number") ? r.data.confidence : null;

      pageObj.ocrText = cleaned;
      pageObj.ocrConfidence = conf;

      const t = App.stateApi.normalize(cleaned);
      if (t.length < 20) {
        pageObj.status = "warn";
        pageObj.reason = "Страница почти пустая. Анализ возможен. Если на листе есть важные 1–2 строки, переснимите ближе к тексту.";
        return;
      }

      const q = App.ocr.evaluateQuality(cleaned, conf);
      pageObj.status = q.status;
      pageObj.reason = q.reason || "";
      return;
    }

    // 3) normal OCR, expand to deu+rus if Cyrillic
    let worker = await App.ocr.getWorker(c.OCR_LANG_FAST);

    App.el.pLine2.textContent = `OCR (deu) — страница ${idx + 1}/${total}`;
    const r1 = await worker.recognize((inkRatio <= c.INK_LOW) ? (pageObj.fastOcrBlob || pageObj.ocrBlob) : pageObj.ocrBlob);

    const rawText1 = (r1.data && r1.data.text) ? r1.data.text : "";
    let cleaned = App.ocr.cleanText(rawText1);
    let conf = (r1.data && typeof r1.data.confidence === "number") ? r1.data.confidence : null;

    const hasCyr = /[А-Яа-яЁёІіЇїЄє]/.test(cleaned);

    if (hasCyr) {
      worker = await App.ocr.getWorker(c.OCR_LANG_FULL);

      App.el.pLine2.textContent = `OCR (deu+rus) — страница ${idx + 1}/${total}`;
      const r2 = await worker.recognize(pageObj.ocrBlob);

      const rawText2 = (r2.data && r2.data.text) ? r2.data.text : "";
      cleaned = App.ocr.cleanText(rawText2);
      conf = (r2.data && typeof r2.data.confidence === "number") ? r2.data.confidence : conf;
    }

    pageObj.ocrText = cleaned;
    pageObj.ocrConfidence = conf;

    const q = App.ocr.evaluateQuality(cleaned, conf);
    pageObj.status = q.status;
    pageObj.reason = q.reason || "";
  }
};

