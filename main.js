/* =========================================================
   main.js — Orchestrator (events + run analysis + safety)
   Assumes other modules already define:
   - DOM vars: cameraBtn, filesBtn, cameraInput, filesInput, carousel, analyzeBtn,
              progressBox, pLine1, pLine2, resultBox, doneBanner, resultTitle,
              resultSupport, resultDetails, aboutText, qualityPanel, etc.
   - Functions: setLocked, updateQualityPanel, renderCarousel, showZeroHintIfNeeded,
                showLimitHint, hasBadPages, firstBadIndex, scrollToPage,
                addFiles, ocrOnePage, updateSlideByIndex, updateCounters, nextFrame,
                closeOcrWorker, analyzeText, showResult
   - Optional: uiFail(msg, err) if you created it in a module
========================================================= */

/* ---------------- Safety: universal UI fail ---------------- */
function _safeUiFail(msg, err) {
  try {
    // if you have a real uiFail in another module
    if (typeof uiFail === "function") {
      uiFail(msg, err);
      return;
    }
  } catch (_) {}

  console.error(msg, err || "");

  // show in progress if possible
  try {
    if (progressBox) progressBox.style.display = "block";
    if (pLine1) pLine1.textContent = "Ошибка";
    if (pLine2) pLine2.textContent = String(msg || "Ошибка");
  } catch (_) {}

  // show in result panel if possible
  try {
    if (resultBox) resultBox.style.display = "block";
    if (doneBanner) doneBanner.style.display = "none";
    if (resultTitle) resultTitle.textContent = "⚠️ Ошибка";
    if (resultSupport) resultSupport.textContent = "Произошла ошибка в Mini App.";
    if (resultDetails) {
      const eMsg = (err && err.message) ? err.message : (err ? String(err) : "");
      resultDetails.textContent = String(msg || "") + (eMsg ? ("\n\n" + eMsg) : "");
    }
    if (aboutText) aboutText.textContent = "—";
  } catch (_) {}

  // unlock UI if possible
  try { if (typeof setLocked === "function") setLocked(false); } catch (_) {}
}

/* ---------------- Global error traps ---------------- */
window.addEventListener("error", (e) => {
  _safeUiFail(`JS ERROR: ${e.message}`, e.error);
});

window.addEventListener("unhandledrejection", (e) => {
  _safeUiFail(`PROMISE ERROR: ${e.reason}`, e.reason);
});

/* ---------------- Optional hard-check: Tesseract exists ----------------
   (Delay a bit: Telegram iOS may load scripts slightly позже)
----------------------------------------------------------------------- */
function hardCheckTesseract() {
  setTimeout(() => {
    if (!window.Tesseract) {
      _safeUiFail(
        "Tesseract.js не загрузился (CDN/интернет/Telegram WebView).",
        ""
      );
    }
  }, 300);
}

/* ---------------- Main analysis runner ---------------- */
async function runAnalysis() {
  if (typeof isLocked !== "undefined" && isLocked) return;

  try {
    if (!pages || pages.length === 0) {
      if (typeof showZeroHintIfNeeded === "function") showZeroHintIfNeeded();
      return;
    }

    if (typeof hasBadPages === "function" && hasBadPages()) {
      if (typeof updateQualityPanel === "function") updateQualityPanel();
      return;
    }

    if (typeof setLocked === "function") setLocked(true);
    if (typeof updateQualityPanel === "function") updateQualityPanel();

    try {
      if (resultBox) resultBox.style.display = "none";
      if (doneBanner) doneBanner.style.display = "none";
    } catch (_) {}

    try {
      if (progressBox) progressBox.style.display = "block";
      if (pLine1) pLine1.textContent = "Анализ идёт";
      if (pLine2) pLine2.textContent = "Контролируем содержание письма";
    } catch (_) {}

    // OCR all pages
    for (let i = 0; i < pages.length; i++) {
      await ocrOnePage(pages[i], i, pages.length);
      updateSlideByIndex(i);
      updateCounters();
      if (typeof nextFrame === "function") await nextFrame();
    }

    if (typeof updateQualityPanel === "function") updateQualityPanel();

    // If BAD appeared after OCR: stop and guide user
    if (typeof hasBadPages === "function" && hasBadPages()) {
      try { if (progressBox) progressBox.style.display = "none"; } catch (_) {}
      if (typeof setLocked === "function") setLocked(false);
      if (typeof updateQualityPanel === "function") updateQualityPanel();
      if (typeof showZeroHintIfNeeded === "function") showZeroHintIfNeeded();

      const fb = (typeof firstBadIndex === "function") ? firstBadIndex() : -1;
      if (fb >= 0 && typeof scrollToPage === "function") scrollToPage(fb);

      if (typeof closeOcrWorker === "function") await closeOcrWorker();
      return;
    }

    // Combine recognized text
    try {
      if (pLine1) pLine1.textContent = "Анализ идёт";
      if (pLine2) pLine2.textContent = "Проверяем, требуется ли от вас действие";
    } catch (_) {}

    const combinedText = pages
      .map((p, idx) => `--- Страница ${idx + 1} ---\n${p.ocrText || ""}`)
      .join("\n\n");

    const res = analyzeText(combinedText);

    try {
      if (pLine1) pLine1.textContent = "Анализ завершён";
      if (pLine2) pLine2.textContent = "Ниже — результат проверки письма";
    } catch (_) {}

    // Show result
    setTimeout(async () => {
      try {
        showResult(res, combinedText);
      } catch (e) {
        _safeUiFail("Ошибка показа результата", e);
      }

      try { if (progressBox) progressBox.style.display = "none"; } catch (_) {}
      try { if (typeof setLocked === "function") setLocked(false); } catch (_) {}
      try { if (typeof updateQualityPanel === "function") updateQualityPanel(); } catch (_) {}
      try { if (typeof showZeroHintIfNeeded === "function") showZeroHintIfNeeded(); } catch (_) {}

      try { if (typeof closeOcrWorker === "function") await closeOcrWorker(); } catch (_) {}
    }, 250);

  } catch (e) {
    try { if (progressBox) progressBox.style.display = "none"; } catch (_) {}
    try { if (typeof setLocked === "function") setLocked(false); } catch (_) {}
    try { if (typeof updateQualityPanel === "function") updateQualityPanel(); } catch (_) {}
    try { if (typeof showZeroHintIfNeeded === "function") showZeroHintIfNeeded(); } catch (_) {}
    try { if (typeof closeOcrWorker === "function") await closeOcrWorker(); } catch (_) {}

    _safeUiFail("Ошибка анализа", e);
  }
}

/* ---------------- Wire events ---------------- */
function bindEvents() {
  // Buttons -> file inputs
  cameraBtn.addEventListener("click", () => {
    if (typeof isLocked !== "undefined" && isLocked) return;
    cameraInput.click();
  });

  filesBtn.addEventListener("click", () => {
    if (typeof isLocked !== "undefined" && isLocked) return;
    filesInput.click();
  });

  // Inputs -> addFiles pipeline
  cameraInput.addEventListener("change", async () => {
    if (typeof isLocked !== "undefined" && isLocked) return;
    await addFiles(cameraInput.files);
  });

  filesInput.addEventListener("change", async () => {
    if (typeof isLocked !== "undefined" && isLocked) return;
    await addFiles(filesInput.files);
  });

  // Carousel counter
  carousel.addEventListener("scroll", () => {
    try { updateCounters(); } catch (_) {}
  });

  // Analyze
  analyzeBtn.addEventListener("click", runAnalysis);
}

/* ---------------- Init ---------------- */
function init() {
  try {
    hardCheckTesseract();

    // initial UI
    if (typeof renderCarousel === "function") renderCarousel();
    if (typeof updateQualityPanel === "function") updateQualityPanel();
    if (typeof showZeroHintIfNeeded === "function") showZeroHintIfNeeded();

    bindEvents();
  } catch (e) {
    _safeUiFail("Ошибка инициализации", e);
  }
}

// Run after DOM ready (safe even if scripts moved)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

