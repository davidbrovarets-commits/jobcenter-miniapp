// main.js — orchestrator (stable)

// Telegram init (safe)
(function initTelegram(){
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  try { if (tg) { tg.ready(); tg.expand(); } } catch (_) {}
})();

function uiError(msg, err) {
  console.error(msg, err || "");
  try {
    if (typeof window.uiFail === "function") window.uiFail(msg, err);
    else alert(msg);
  } catch (_) {}
}

async function runAnalysis() {
  if (App.state.isLocked) return;

  if (!App.state.pages.length) {
    App.qualityUi.showZeroHintIfNeeded();
    return;
  }

  if (App.stateApi.hasBadPages()) {
    App.qualityUi.updateQualityPanel();
    return;
  }

  App.qualityUi.setLocked(true);
  App.qualityUi.updateQualityPanel();

  App.el.resultBox.style.display = "none";
  App.el.doneBanner.style.display = "none";

  App.el.progressBox.style.display = "block";
  App.el.pLine1.textContent = "Анализ идёт";
  App.el.pLine2.textContent = "Контролируем содержание письма";

  try {
    for (let i = 0; i < App.state.pages.length; i++) {
      await App.ocr.ocrOnePage(App.state.pages[i], i, App.state.pages.length);
      App.carouselUi.updateSlideByIndex(i);
      App.carouselUi.updateCounters();
      await App.stateApi.nextFrame();
    }

    App.qualityUi.updateQualityPanel();

    // if bad appeared — block and jump
    if (App.stateApi.hasBadPages()) {
      App.el.progressBox.style.display = "none";
      App.qualityUi.setLocked(false);
      App.qualityUi.updateQualityPanel();
      App.qualityUi.showZeroHintIfNeeded();

      const fb = App.stateApi.firstBadIndex();
      if (fb >= 0) App.carouselUi.scrollToPage(fb);

      await App.ocr.closeWorker();
      return;
    }

    App.el.pLine1.textContent = "Анализ идёт";
    App.el.pLine2.textContent = "Проверяем, требуется ли от вас действие";

    const combinedText = App.state.pages
      .map((p, idx) => `--- Страница ${idx + 1} ---\n${p.ocrText || ""}`)
      .join("\n\n");

    const res = App.analysis.analyzeText(combinedText);

    App.el.pLine1.textContent = "Анализ завершён";
    App.el.pLine2.textContent = "Ниже — результат проверки письма";

    setTimeout(async () => {
      App.analysis.showResult(res, combinedText);

      App.el.progressBox.style.display = "none";
      App.qualityUi.setLocked(false);
      App.qualityUi.updateQualityPanel();
      App.qualityUi.showZeroHintIfNeeded();

      await App.ocr.closeWorker();
    }, 250);

  } catch (e) {
    App.el.progressBox.style.display = "none";
    App.qualityUi.setLocked(false);
    App.qualityUi.updateQualityPanel();
    App.qualityUi.showZeroHintIfNeeded();

    App.el.resultBox.style.display = "block";
    App.el.doneBanner.style.display = "none";
    App.el.resultTitle.textContent = "⚠️ Неясно — нужна проверка";
    App.el.resultSupport.textContent = "Произошла ошибка при анализе. Ниже — как улучшить результат.";
    App.el.resultDetails.textContent =
      "Как улучшить результат:\n" +
      "• переснимите страницы ближе к тексту, без бликов и теней\n" +
      "• добавьте страницу со сроком или просьбой (Bitte / Frist / Termin)\n";
    App.el.aboutText.textContent = "—";

    await App.ocr.closeWorker();
    uiError("Ошибка анализа.", e);
  }
}

// Init after DOM ready
document.addEventListener("DOMContentLoaded", () => {
  try {
    // 1) DOM + UI init
    App.dom.init();

    // 2) bind quality panel buttons
    App.qualityUi.bindPanelButtons();

    // 3) bind inputs (IMPORTANT: iOS uses label->input; we only listen change)
    App.el.cameraInput.addEventListener("change", async () => {
      try {
        await App.images.addFiles(App.el.cameraInput.files);
      } catch (e) {
        uiError("Ошибка: не удалось добавить фото.", e);
      } finally {
        // allow re-pick same photo
        try { App.el.cameraInput.value = ""; } catch(_) {}
      }
    });

    App.el.filesInput.addEventListener("change", async () => {
      try {
        await App.images.addFiles(App.el.filesInput.files);
      } catch (e) {
        uiError("Ошибка: не удалось добавить файлы.", e);
      } finally {
        try { App.el.filesInput.value = ""; } catch(_) {}
      }
    });

    // 4) carousel scroll counters
    App.el.carousel.addEventListener("scroll", () => {
      try { App.carouselUi.updateCounters(); } catch(_) {}
    });

    // 5) analyze button
    App.el.analyzeBtn.addEventListener("click", runAnalysis);

    // 6) initial render
    App.carouselUi.renderCarousel();
    App.qualityUi.updateQualityPanel();
    App.qualityUi.showZeroHintIfNeeded();

    // expose for debug
    window.runAnalysis = runAnalysis;

  } catch (e) {
    uiError("Ошибка инициализации. Проверь порядок скриптов и наличие модулей.", e);
  }
});
