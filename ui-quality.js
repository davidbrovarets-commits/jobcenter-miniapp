// ui-quality.js
window.App = window.App || {};

App.qualityUi = {
  escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  showZeroHintIfNeeded() {
    const { zeroHint, analyzeBtn } = App.el;
    const { pages, isLocked } = App.state;

    zeroHint.style.display = (pages.length === 0) ? "block" : "none";
    analyzeBtn.disabled = isLocked || pages.length === 0 || App.stateApi.hasBadPages();
  },

  showLimitHint(v) {
    App.el.limitHint.style.display = v ? "block" : "none";
  },

  setLocked(v) {
    App.state.isLocked = v;

    const { analyzeBtn } = App.el;

    // disable delete buttons inside carousel
    try {
      App.el.carousel.querySelectorAll(".delBtn").forEach(btn => btn.disabled = v);
    } catch (_) {}

    // panel buttons
    App.el.showBadBtn.disabled = v;
    App.el.deleteCurrentBadBtn.disabled = v;
    App.el.deleteBadBtn.disabled = v;
    App.el.showWarnBtn.disabled = v;

    analyzeBtn.disabled = v || App.state.pages.length === 0 || App.stateApi.hasBadPages();
  },

  renderQualityList() {
    const { qualityList } = App.el;
    const { pages } = App.state;

    qualityList.style.display = "none";
    qualityList.innerHTML = "";
    if (!pages.length) return;

    const rows = [];
    pages.forEach((p, i) => {
      if (p.status !== "bad" && p.status !== "warn") return;

      const tag = (p.status === "bad") ? "BAD" : "WARN";
      const reason = (p.reason || "").trim() || (
        p.status === "bad"
          ? "Обнаружена плохо читаемая страница. Рекомендуем заменить для точного результата."
          : "Текст распознан частично. Для точности лучше переснять страницу."
      );

      rows.push(`
        <div class="pageListRow">
          <div class="pageTag ${p.status}">${tag}</div>
          <div class="pageListText"><b>Страница ${i + 1}</b><br>${App.qualityUi.escapeHtml(reason)}</div>
        </div>
      `);
    });

    if (!rows.length) return;
    qualityList.innerHTML = rows.join("");
    qualityList.style.display = "flex";
  },

  updateQualityPanel() {
    const { pages } = App.state;
    const {
      qualityPanel, qualityTitle, qualityText,
      showBadBtn, deleteCurrentBadBtn, deleteBadBtn, showWarnBtn, analyzeBtn
    } = App.el;

    qualityPanel.style.display = "none";
    App.qualityUi.renderQualityList();

    if (!pages.length) return;

    const bad = App.stateApi.badIndexes();
    const warn = App.stateApi.warnIndexes();

    if (bad.length > 0) {
      qualityPanel.style.display = "block";
      qualityTitle.textContent = "Обнаружены нечитаемые страницы";
      qualityText.textContent =
        "Нечитаемые страницы: " + bad.join(", ") + "\n" +
        "Чтобы анализ был точным, замените или удалите их.";

      showBadBtn.style.display = "inline-flex";
      deleteCurrentBadBtn.style.display = "inline-flex";
      deleteBadBtn.style.display = "inline-flex";
      showWarnBtn.style.display = (warn.length > 0) ? "inline-flex" : "none";

      analyzeBtn.disabled = true;
      return;
    }

    if (warn.length > 0) {
      qualityPanel.style.display = "block";
      qualityTitle.textContent = "Есть частично распознанные страницы";
      qualityText.textContent =
        "Страницы: " + warn.join(", ") + "\n" +
        "Анализ возможен. Для максимальной точности лучше переснять эти страницы.";

      showBadBtn.style.display = "none";
      deleteCurrentBadBtn.style.display = "none";
      deleteBadBtn.style.display = "none";
      showWarnBtn.style.display = "inline-flex";

      analyzeBtn.disabled = App.state.isLocked || pages.length === 0;
      return;
    }

    analyzeBtn.disabled = App.state.isLocked || pages.length === 0;
  },

  bindPanelButtons() {
    const { showBadBtn, showWarnBtn, deleteCurrentBadBtn, deleteBadBtn } = App.el;

    showBadBtn.addEventListener("click", () => {
      const i = App.stateApi.firstBadIndex();
      if (i >= 0) App.carouselUi.scrollToPage(i);
    });

    showWarnBtn.addEventListener("click", () => {
      const i = App.stateApi.firstWarnIndex();
      if (i >= 0) App.carouselUi.scrollToPage(i);
    });

    deleteCurrentBadBtn.addEventListener("click", () => {
      if (App.state.isLocked) return;
      if (!App.state.pages.length) return;

      const current = App.carouselUi.getVisibleIndex();
      const p = App.state.pages[current];

      if (p && p.status === "bad") {
        App.images.removePage(p.id);
        return;
      }

      const fb = App.stateApi.firstBadIndex();
      if (fb >= 0) App.images.removePage(App.state.pages[fb].id);
    });

    deleteBadBtn.addEventListener("click", () => {
      if (App.state.isLocked) return;
      const ids = App.state.pages.filter(p => p.status === "bad").map(p => p.id);
      ids.forEach(id => App.images.removePage(id));
    });
  }
};
