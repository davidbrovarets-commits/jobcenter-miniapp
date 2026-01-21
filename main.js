// main.js — orchestrator (safe, waits for App.el)

(function () {
  // 1) Telegram init (safe)
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  try { if (tg) { tg.ready(); tg.expand(); } } catch (_) {}

  // 2) Helpers
  function uiError(msg, err) {
    console.error(msg, err || "");
    try {
      if (window.App && window.App.uiBase && typeof window.App.uiBase.uiFail === "function") {
        return window.App.uiBase.uiFail(msg, err);
      }
    } catch (_) {}
    try {
      if (typeof window.uiFail === "function") return window.uiFail(msg, err);
    } catch (_) {}
    alert(msg + (err && err.message ? ("\n\n" + err.message) : ""));
  }

  function waitFor(predicate, timeoutMs = 8000, stepMs = 50) {
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        try {
          const v = predicate();
          if (v) return resolve(v);
        } catch (_) {}
        if (Date.now() - t0 > timeoutMs) return reject(new Error("Not ready: App.el"));
        setTimeout(tick, stepMs);
      };
      tick();
    });
  }

  function getAddFilesFn() {
    // Most common export we want:
    if (typeof window.addFiles === "function") return window.addFiles;

    // If you export via App.images / App.imagePipeline:
    if (window.App && window.App.images && typeof window.App.images.addFiles === "function") return window.App.images.addFiles;
    if (window.App && window.App.imagePipeline && typeof window.App.imagePipeline.addFiles === "function") return window.App.imagePipeline.addFiles;

    // Alternative namespaces:
    if (window.ImagePipeline && typeof window.ImagePipeline.addFiles === "function") return window.ImagePipeline.addFiles;
    if (window.imagePipeline && typeof window.imagePipeline.addFiles === "function") return window.imagePipeline.addFiles;

    return null;
  }

  function safeCall(fn, ...args) {
    try { if (typeof fn === "function") return fn(...args); } catch (_) {}
  }

  // 3) Boot
  async function boot() {
    // Wait until dom.js created App.el and key elements
    await waitFor(() => window.App && window.App.el && window.App.el.cameraBtn && window.App.el.filesBtn);

    const App = window.App;
    const el = App.el;

    // Enable buttons (in case something locked them)
    try {
      el.cameraBtn.disabled = false;
      el.filesBtn.disabled = false;
    } catch (_) {}

    // --- Bind UI events ---
    el.cameraBtn.addEventListener("click", () => {
      try { el.cameraInput.click(); } catch (e) { uiError("Не удалось открыть камеру.", e); }
    });

    el.filesBtn.addEventListener("click", () => {
      try { el.filesInput.click(); } catch (e) { uiError("Не удалось открыть выбор файлов.", e); }
    });

    el.cameraInput.addEventListener("change", async () => {
      try {
        const addFiles = getAddFilesFn();
        if (!addFiles) throw new Error("addFiles() is not available (check image-pipeline.js export).");
        await addFiles(el.cameraInput.files);
      } catch (e) {
        uiError("Ошибка: не удалось добавить фото. (addFiles)", e);
      } finally {
        try { el.cameraInput.value = ""; } catch (_) {}
      }
    });

    el.filesInput.addEventListener("change", async () => {
      try {
        const addFiles = getAddFilesFn();
        if (!addFiles) throw new Error("addFiles() is not available (check image-pipeline.js export).");
        await addFiles(el.filesInput.files);
      } catch (e) {
        uiError("Ошибка: не удалось добавить файлы. (addFiles)", e);
      } finally {
        try { el.filesInput.value = ""; } catch (_) {}
      }
    });

    el.carousel.addEventListener("scroll", () => {
      // update counters if exists
      safeCall(window.updateCounters);
      safeCall(App.uiCarousel && App.uiCarousel.updateCounters);
    });

    el.analyzeBtn.addEventListener("click", async () => {
      try {
        // If you have a single entrypoint:
        if (typeof window.runAnalysis === "function") return await window.runAnalysis();
        if (App.analysis && typeof App.analysis.runAnalysis === "function") return await App.analysis.runAnalysis();

        // Otherwise: analysis might already be bound elsewhere, so do nothing.
      } catch (e) {
        uiError("Ошибка анализа.", e);
      }
    });

    // --- Initial UI paint ---
    safeCall(window.renderCarousel);
    safeCall(App.uiCarousel && App.uiCarousel.renderCarousel);

    safeCall(window.updateQualityPanel);
    safeCall(App.uiQuality && App.uiQuality.updateQualityPanel);

    safeCall(window.showZeroHintIfNeeded);
    safeCall(App.uiBase && App.uiBase.showZeroHintIfNeeded);
  }

  // Start after DOM parsing
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(e => uiError("Ошибка инициализации. Проверь порядок подключаемых скриптов и наличие модулей.", e)));
  } else {
    boot().catch(e => uiError("Ошибка инициализации. Проверь порядок подключаемых скриптов и наличие модулей.", e));
  }
})();
