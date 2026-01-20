// ui-carousel.js
window.App = window.App || {};

App.carouselUi = {
  getVisibleIndex() {
    const { pages } = App.state;
    const { carousel } = App.el;
    if (!pages.length) return 0;

    const slides = Array.from(carousel.querySelectorAll(".slide"));
    if (!slides.length) return 0;

    const left = carousel.scrollLeft;
    let best = 0, bestDist = Infinity;

    slides.forEach((s, i) => {
      const dist = Math.abs(s.offsetLeft - left);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  },

  updateCounters() {
    const { pages } = App.state;
    const { pagesCount, pageIndex } = App.el;

    pagesCount.textContent = "Добавлено: " + pages.length;

    if (pages.length === 0) {
      pageIndex.textContent = "Страница: 0 / 0";
    } else {
      pageIndex.textContent = "Страница: " + (App.carouselUi.getVisibleIndex() + 1) + " / " + pages.length;
    }
  },

  scrollToPage(index) {
    const { carousel } = App.el;
    const slides = Array.from(carousel.querySelectorAll(".slide"));
    const s = slides[index];
    if (!s) return;
    carousel.scrollTo({ left: s.offsetLeft, behavior: "smooth" });
  },

  renderCarousel(removePageFn) {
    const { pages } = App.state;
    const { carousel, carouselWrap } = App.el;

    carousel.innerHTML = "";

    if (pages.length === 0) {
      carouselWrap.style.display = "none";
      App.carouselUi.updateCounters();
      App.uiBase.showZeroHintIfNeeded();
      return;
    }

    carouselWrap.style.display = "block";

    pages.forEach((p, idx) => {
      const slide = document.createElement("div");
      slide.className = "slide " + p.status;
      slide.dataset.id = p.id;

      const img = document.createElement("img");
      img.src = p.thumbUrl;
      img.alt = "Страница " + (idx + 1);

      const meta = document.createElement("div");
      meta.className = "slideMeta";

      const pageNo = document.createElement("div");
      pageNo.className = "pageNo";
      pageNo.textContent = "Стр. " + (idx + 1);

      const del = document.createElement("button");
      del.className = "delBtn";
      del.type = "button";
      del.textContent = "Удалить";
      del.dataset.del = p.id;
      del.disabled = App.state.isLocked;

      del.addEventListener("click", () => {
        if (App.state.isLocked) return;
        removePageFn(p.id);
      });

      meta.appendChild(pageNo);
      meta.appendChild(del);

      const badNote = document.createElement("div");
      badNote.className = "badNote";
      badNote.textContent = p.reason || "Обнаружена плохо читаемая страница. Рекомендуем заменить для точного результата.";

      const warnNote = document.createElement("div");
      warnNote.className = "warnNote";
      warnNote.textContent = p.reason || "Текст распознан частично. Для точности лучше переснять страницу.";

      slide.appendChild(img);
      slide.appendChild(meta);
      slide.appendChild(badNote);
      slide.appendChild(warnNote);

      carousel.appendChild(slide);
    });

    App.carouselUi.updateCounters();
    App.uiBase.showZeroHintIfNeeded();
  },

  updateSlideByIndex(idx) {
    const slide = App.el.carousel.querySelectorAll(".slide")[idx];
    if (!slide) return;

    slide.classList.remove("ok","warn","bad");
    slide.classList.add(App.state.pages[idx].status);

    const badNote = slide.querySelector(".badNote");
    const warnNote = slide.querySelector(".warnNote");

    if (badNote) badNote.textContent = App.state.pages[idx].reason || "Обнаружена плохо читаемая страница. Рекомендуем заменить для точного результата.";
    if (warnNote) warnNote.textContent = App.state.pages[idx].reason || "Текст распознан частично. Для точности лучше переснять страницу.";
  }
};

