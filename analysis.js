// analysis.js
window.App = window.App || {};

App.analysis = {
  findDeadline(text) {
    // simplest date pick
    const m1 = text.match(/\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/);
    if (m1) return m1[1];

    const m2 = text.match(/\b(bis zum|spätestens am|frist|fristen|bis spätestens)\s+(\d{1,2}\.\d{1,2}\.\d{2,4})\b/i);
    if (m2) return m2[2];

    return "";
  },

  analyzeText(raw) {
    const t = App.stateApi.normalize(raw);
    if (t.length < 100) return { kind: "unclear", deadline: "", signals: [] };

    const signalsAction = [
      "bitte","wir bitten","sie werden gebeten","sie sind verpflichtet",
      "erforderlich","nachweisen","nachweis","einreichen","vorlegen",
      "termin","einladung","melden sie sich","rückmeldung",
      "frist","bis zum","spätestens","umgehend",
      "anhörung","mitwirkung","aufforderung","fehlende unterlagen",
      "unterlagen","kontoauszüge","mietvertrag","ausfüllen","formular",
      "kundennummer","aktenzeichen"
    ];

    const found = signalsAction.filter(w => t.includes(w));
    const deadline = App.analysis.findDeadline(t);

    if (found.length >= 2 || (found.length >= 1 && (t.includes("frist") || t.includes("termin") || deadline))) {
      return { kind: "needAction", deadline, signals: found.slice(0, 6) };
    }

    return { kind: "noAction", deadline: "", signals: [] };
  },

  aboutLetter(raw) {
    const t = App.stateApi.normalize(raw);
    if (t.length < 100) {
      return "Текста недостаточно. Добавьте страницу с основной частью письма (где указаны просьбы, сроки или термин).";
    }
    const hasTermin = /termin|einladung|melden sie sich|vorsprechen/.test(t);
    const hasDocs = /unterlagen|nachweis|nachweisen|einreichen|vorlegen|mitwirkung|aufforderung|fehlende|ausfüllen|formular/.test(t);
    const hasPay = /bürgergeld|zahlung|auszahlung|betrag|überweisung|monatlich|leistungen|euro|summe/.test(t);
    const hasBescheid = /bescheid|änderungsbescheid|bewilligung|bewilligungsbescheid|mitteilung|veränderungsmitteilung/.test(t);

    if (hasTermin) return "В письме есть слова, связанные с термином/встречей. Обычно это означает необходимость прийти или ответить.";
    if (hasDocs) return "В письме есть слова, связанные с документами/подтверждениями. Обычно это означает необходимость предоставить документы.";
    if (hasPay) return "В письме есть слова, связанные с выплатами/суммами. Часто это информирование о расчётах.";
    if (hasBescheid) return "В письме есть слова, связанные с решением/уведомлением (Bescheid). Проверьте, есть ли сроки или просьбы.";
    return "Письмо содержит общий текст. Для точности важны страницы со сроком или просьбой (Bitte / Frist / Termin).";
  },

  showResult(res, combinedText) {
    const { resultBox, doneBanner, resultTitle, resultSupport, resultDetails, aboutText } = App.el;

    if (res.kind === "needAction") {
      resultTitle.textContent = "✅ Требуется действие";
      resultSupport.textContent = "Это нормально. Ниже — пояснение, что именно требуется.";

      const sig = res.signals.length ? ("Найдены сигналы: " + res.signals.join(", ") + "\n") : "";
      const dl = res.deadline ? ("Срок, указанный в тексте: " + res.deadline + "\n") : "";

      resultDetails.textContent =
        sig + dl +
        "Что сделать:\n" +
        "• проверьте, просят ли предоставить документы (Unterlagen / Nachweis),\n" +
        "• или прийти/ответить по термину (Termin / Einladung),\n" +
        "• или заполнить форму (Formular / ausfüllen).\n";
    }
    else if (res.kind === "noAction") {
      resultTitle.textContent = "❌ Действие не требуется";
      resultSupport.textContent = "Это информационное письмо. Обычно в таком случае никаких действий не требуется.";
      resultDetails.textContent = "Если вы ожидаете запрос документов или приглашение — проверьте, не пропущена ли какая-то страница.";
    }
    else {
      resultTitle.textContent = "⚠️ Неясно — нужна проверка";
      resultSupport.textContent = "В письме есть неоднозначные формулировки. Ниже — на что стоит обратить внимание.";
      resultDetails.textContent =
        "Как улучшить результат:\n" +
        "• добавьте страницу со сроком или просьбой (Bitte / Frist / Termin)\n" +
        "• переснимите страницы ближе к тексту, без бликов и теней\n";
    }

    aboutText.textContent = App.analysis.aboutLetter(combinedText);

    doneBanner.style.display = "block";
    resultBox.style.display = "block";
  }
};
