// Tab switching for the three games. The URL hash (#obby, #city, #grab) remembers the tab.
(function () {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const ids = tabs.map((t) => t.dataset.game);

  function show(id, focus) {
    if (!ids.includes(id)) id = ids[0];
    tabs.forEach((tab) => {
      const on = tab.dataset.game === id;
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
      const panel = document.getElementById(tab.dataset.game);
      panel.hidden = !on;
      const video = panel.querySelector('video');
      if (on) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      history.replaceState(null, '', '#' + tab.dataset.game);
      show(tab.dataset.game);
    });
    tab.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      if (j !== null) {
        e.preventDefault();
        history.replaceState(null, '', '#' + ids[j]);
        show(ids[j], true);
      }
    });
  });

  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
})();
