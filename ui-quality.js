// ui-quality.js
window.App = window.App || {};

App.qualityUi = {
  renderQualityList() {
    const { qualityList } = App.el;
    if (!qualityList) return;

    qualityList.style.display = "none";
    qualityList.innerHTML = "";

    const { pages } = App.state;
    if (pages.length === 0) return;

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
          <div class="pageListText"><b>Страница ${i + 1}</b><br>${App.uiBase.escapeHtml(reason)}</div>
        </div>
      `);
    });

    if (!rows.length) return;
    qualityList.innerHTML = rows.join("");
    qualityList.style.display = "flex";
  },

  updateQualityPanel() {
    const { pages } = App.state;
    const el = App.el;

    el.qualityPanel.style.display = "none";
    App.qualityUi.renderQualityList();

    if (pages.length === 0) return;

    const bad = App.stateApi.badIndexes();
    const warn = App.stateApi.warnIndexes();

    if (bad.length > 0) {
      el.qualityPanel.style.display = "block";
      el.qualityTitle.textContent = "Обнаружены нечитаемые страницы";
      el.qualityText.textContent =
        "Нечитаемые страницы: " + bad.join(", ") + "\n" +
        "Чтобы анализ был точным, замените или удалите их.";

      el.showBadBtn.style.display = "inline-flex";
      el.deleteCurrentBadBtn.style.display = "inline-flex";
      el.deleteBadBtn.style.display = "inline-flex";
      el.showWarnBtn.style.display = (warn.length > 0) ? "inline-flex" : "none";

      el.analyzeBtn.disabled = true;
      return;
    }

    if (warn.length > 0) {
      el.qualityPanel.style.display = "block";
      el.qualityTitle.textContent = "Есть частично распознанные страницы";
      el.qualityText.textContent =
        "Страницы: " + warn.join(", ") + "\n" +
        "Анализ возможен. Для максимальной точности лучше переснять эти страницы.";

      el.showBadBtn.style.display = "none";
      el.deleteCurrentBadBtn.style.display = "none";
      el.deleteBadBtn.style.display = "none";
      el.showWarnBtn.style.display = "inline-flex";

      el.analyzeBtn.disabled = App.state.isLocked || pages.length === 0;
      return;
    }

    el.analyzeBtn.disabled = App.state.isLocked || pages.length === 0;
  }
};

