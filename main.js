// main.js — orchestrator (safe)

// 1) Telegram init (safe)
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { if (tg) { tg.ready(); tg.expand(); } } catch (_) {}

// 2) Small helpers
function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element: #${id}`);
  return el;
}

function uiError(msg, err) {
  console.error(msg, err || "");
  // если у тебя есть uiFail из dom.js — используем
  try {
    if (typeof window.uiFail === "function") return window.uiFail(msg, err);
  } catch (_) {}
  // fallback
  alert(msg);
}

function getAddFilesFn() {
  // поддержка разных вариантов экспорта
  if (typeof window.addFiles === "function") return window.addFiles;
  if (window.ImagePipeline && typeof window.ImagePipeline.addFiles === "function") return window.ImagePipeline.addFiles;
  if (window.imagePipeline && typeof window.imagePipeline.addFiles === "function") return window.imagePipeline.addFiles;
  return null;
}

// 3) DOM
const cameraBtn = must("cameraBtn");
const filesBtn = must("filesBtn");
const cameraInput = must("cameraInput");
const filesInput = must("filesInput");
const carousel = must("carousel");
const analyzeBtn = must("analyzeBtn");

// 4) Bind events
cameraBtn.addEventListener("click", () => {
  try { cameraInput.click(); } catch (e) { uiError("Не удалось открыть камеру.", e); }
});

filesBtn.addEventListener("click", () => {
  try { filesInput.click(); } catch (e) { uiError("Не удалось открыть выбор файлов.", e); }
});

cameraInput.addEventListener("change", async () => {
  try {
    const addFiles = getAddFilesFn();
    if (!addFiles) throw new Error("addFiles() is not available. Check image-pipeline.js export and script order.");
    await addFiles(cameraInput.files);
  } catch (e) {
    uiError("Ошибка: не удалось добавить фото. (addFiles)", e);
  } finally {
    // чтобы повторное фото с тем же именем сработало
    try { cameraInput.value = ""; } catch (_) {}
  }
});

filesInput.addEventListener("change", async () => {
  try {
    const addFiles = getAddFilesFn();
    if (!addFiles) throw new Error("addFiles() is not available. Check image-pipeline.js export and script order.");
    await addFiles(filesInput.files);
  } catch (e) {
    uiError("Ошибка: не удалось добавить файлы. (addFiles)", e);
  } finally {
    try { filesInput.value = ""; } catch (_) {}
  }
});

// прокрутка карусели → обновление счетчиков
carousel.addEventListener("scroll", () => {
  try {
    if (typeof window.updateCounters === "function") window.updateCounters();
  } catch (_) {}
});

// запуск анализа (делегируем в твой существующий код/модули)
analyzeBtn.addEventListener("click", async () => {
  try {
    // если у тебя есть функция типа runAnalysis — вызывай её
    if (typeof window.runAnalysis === "function") {
      await window.runAnalysis();
      return;
    }

    // иначе — если в твоей архитектуре анализ висит на analyzeBtn в другом модуле,
    // то этот блок можно оставить пустым.
    // (но лучше иметь единый entrypoint runAnalysis)
  } catch (e) {
    uiError("Ошибка анализа.", e);
  }
});

// 5) Init UI (если эти функции существуют в твоих модулях)
try { if (typeof window.renderCarousel === "function") window.renderCarousel(); } catch (_) {}
try { if (typeof window.updateQualityPanel === "function") window.updateQualityPanel(); } catch (_) {}
try { if (typeof window.showZeroHintIfNeeded === "function") window.showZeroHintIfNeeded(); } catch (_) {}
