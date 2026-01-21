// main.js — orchestrator (safe, waits for App.el) + iOS picker fix

(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  try { if (tg) { tg.ready(); tg.expand(); } } catch (_) {}

  function uiError(msg, err) {
    console.error(msg, err || "");
    try {
      if (window.App && window.App.uiBase && typeof window.App.uiBase.uiFail === "function") {
        return window.App.uiBase.uiFail(msg, err);
      }
    } catch (_) {}
    try { if (typeof window.uiFail === "function") return window.uiFail(msg, err); } catch (_) {}
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
    if (typeof window.addFiles === "function") return window.addFiles;
    if (window.App && window.App.images && typeof window.App.images.addFiles === "function") return window.App.images.addFiles;
    if (window.App && window.App.imagePipeline && typeof window.App.imagePipeline.addFiles === "function") return window.App.imagePipeline.addFiles;
    return null;
  }

  function openFilePicker(inputEl) {
    // iOS/WebKit: showPicker() часто работает лучше
    if (!inputEl) throw new Error("Missing file input element");
    if (typeof inputEl.showPicker === "function") {
      inputEl.showPicker();
      return;
    }
    inputEl.click();
  }

  async function boot() {
    await waitFor(() => window.App && window.App.el && window.App.el.cameraBtn && window.App.el.filesBtn);

    const App = window.App;
    const el = App.el;

    // на всякий случай разблокируем
    try { el.cameraBtn.disabled = false; el.filesBtn.disabled = false; } catch (_) {}

    el.cameraBtn.addEventListener("click", () => {
      try { openFilePicker(el.cameraInput); } catch (e) { uiError("Не удалось открыть камеру.", e); }
    });

    el.filesBtn.addEventListener("click", () => {
      try { openFilePicker(el.filesInput); } catch (e) { uiError("Не удалось открыть выбор файлов.", e); }
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(e => uiError("Ошибка инициализации.", e)));
  } else {
    boot().catch(e => uiError("Ошибка инициализации.", e));
  }
})();
