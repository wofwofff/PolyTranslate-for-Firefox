document.documentElement.lang = chrome.i18n.getUILanguage();

document.querySelectorAll("[data-locale]").forEach((elem) => {
  const translation = chrome.i18n.getMessage(elem.dataset.locale);

  if (translation) {
    elem.textContent = translation;
  }
});
