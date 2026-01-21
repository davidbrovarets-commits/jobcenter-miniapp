// main.js — orchestrator (no dependency on App.el)

(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  try { if (tg) { tg.ready(); tg.expand(); } } catch (_) {}

  function must(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Missing DOM element: #" + id);
    return el;
  }

  function uiError(msg, err) {
    console.error(msg, err || "");
    // if you have uiFail somewhere, use it
    try {
      if (typeof window.uiFail === "function") return window.uiFail(msg, err);
      if (window.App && window.App.uiBase && typeof window.App.uiBase.uiFail === "function") {
        return window.App.uiBase.uiFail(msg, err);
      }
    } catch (_) {}
    alert(msg + (err && err.message ? ("\n\n" + err.message) : ""));
  }

  function getAddFilesFn() {
    // support several export styles
    if (typeof window.addFiles === "function") return window.addFiles;
    if (window.ImagePipeline && typeof window.ImagePipeline.addFiles === "function") return window.ImagePipeline.addFiles;
    if (window.imagePipeline && typeof window.imagePipeline.addFiles === "function") return window.imagePipeline.addFiles;
    if (window.App && window.App.images && typeof window.App.images.addFiles === "function") return window.App.images.addFiles;
    if (window.App && window.App.imagePipeline && typeof window.App.imagePipeline.addFiles === "function") return window.App.imagePipeline.addFiles;
    return null;
  }

  function bind() {
    const cameraInput = must("cameraInput");
    const filesInput  = must("filesInput");
    const carousel     = must("carousel");
    const analyzeBtn   = must("analyzeBtn");

    // IMPORTANT:
    // Picker opens via <label for="..."> in index.html, so here we only handle change events.

    cameraInput.addEventListener("change", async () => {
      try {
        const addFiles = getAddFilesFn();
        if (!addFiles) throw new Error("addFiles() is not available. Check image-pipeline.js export.");
        await addFiles(cameraInput.files);
      } catch (e) {
        uiError("Ошибка: не удалось добавить фото. (addFiles)", e);
      } finally {
        try { cameraInput.value = ""; } catch (_) {}
      }
    });

    filesInput.addEventListener("change", async () => {
      try {
        const addFiles = getAddFilesFn();
        if (!addFiles) throw new Error("addFiles() is not available. Check image-pipeline.js export.");
        await addFiles(filesInput.files);
      } catch (e) {
        uiError("Ошибка: не удалось добавить файлы. (addFiles)", e);
      } finally {
        try { filesInput.value = ""; } catch (_) {}
      }
    });

    // carousel scroll -> counters if exist
    carousel.addEventListener("scroll", () => {
      try { if (typeof window.updateCounters === "function") window.updateCounters(); } catch (_) {}
    });

    // analysis (if you have a global entry)
    analyzeBtn.addEventListener("click", async () => {
      try {
        if (typeof window.runAnalysis === "function") {
          await window.runAnalysis();
        }
      } catch (e) {
        uiError("Ошибка анализа.", e);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try { bind(); } catch (e) { uiError("Ошибка инициализации.", e); }
    });
  } else {
    try { bind(); } catch (e) { uiError("Ошибка инициализации.", e); }
  }
})();
