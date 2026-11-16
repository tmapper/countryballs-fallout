// Dil: oyunun seçili dili (localStorage) ya da tarayıcı dili; üstteki düğmelerle değişir
(function () {
  var saved = ''; try { saved = localStorage.getItem('cfs_language') || ''; } catch (e) {}
  var lang = /^(tr|en)$/.test(location.hash.slice(1)) ? location.hash.slice(1) : (saved || (navigator.language || 'tr')).slice(0, 2);
  function set(l) { document.body.classList.toggle('en', l === 'en'); document.documentElement.lang = l === 'en' ? 'en' : 'tr';
    document.querySelectorAll('[data-l]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-l') === (l === 'en' ? 'en' : 'tr')); }); }
  document.querySelectorAll('[data-l]').forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-l')); }); });
  set(lang === 'en' ? 'en' : 'tr');
})();
