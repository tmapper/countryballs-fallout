// ============================================================
// LangPicker.js - Dil seçme penceresi (10 dil). Ana menü / lobi / ayarlardaki dil düğmeleri bunu açar.
// ============================================================
import { i18n, LANGS } from '../systems/I18n.js';

let root = null;
export function openLangPicker() {
  closeLangPicker();
  root = document.createElement('div');
  root.className = 'langpick';
  root.innerHTML = `<div class="lp-card"><div class="lp-title"></div><div class="lp-grid">${
    LANGS.map(([code, name]) => `<button type="button" data-v="${code}" dir="auto"><b>${name}</b><small>${code.toUpperCase()}</small></button>`).join('')
  }</div></div>`;
  root.querySelector('.lp-title').textContent = '🌐 ' + i18n.t('ui.language');
  root.querySelectorAll('.lp-grid button').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === i18n.lang);
    b.addEventListener('click', () => {
      b.classList.add('busy');
      i18n.setLanguage(b.dataset.v).then(closeLangPicker);
    });
  });
  root.addEventListener('pointerdown', (e) => { if (e.target === root) closeLangPicker(); });
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeLangPicker(); } };
  root._esc = esc;
  window.addEventListener('keydown', esc, true);
  document.body.appendChild(root);
}
export function closeLangPicker() {
  if (!root) return;
  window.removeEventListener('keydown', root._esc, true);
  root.remove(); root = null;
}
