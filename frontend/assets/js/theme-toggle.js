/* DukaanHub theme toggle — persists choice to localStorage ("dukaanhub-theme"). */
(function () {
  'use strict';

  var btn = document.querySelector('.fx-theme');
  if (!btn) return;

  function apply(light, persist) {
    document.documentElement.classList.toggle('light', light);
    btn.setAttribute('aria-checked', String(light));
    btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    if (persist) {
      try { localStorage.setItem('dukaanhub-theme', light ? 'light' : 'dark'); } catch (e) {}
    }
  }

  // Sync with the class set by the inline head script
  apply(document.documentElement.classList.contains('light'), false);

  btn.addEventListener('click', function () {
    document.documentElement.classList.add('fx-theme-anim');
    apply(!document.documentElement.classList.contains('light'), true);
    setTimeout(function () {
      document.documentElement.classList.remove('fx-theme-anim');
    }, 420);
  });
})();
