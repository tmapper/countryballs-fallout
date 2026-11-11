// ============================================================
// ExitGame.js - Oyundan çık (APK / EXE / tarayıcı)
// ============================================================
// APK: Capacitor App eklentisi varsa uygulamayı kapatır. EXE (Electron): pencereyi kapatır.
// Tarayıcı sekmeleri kendi kendini kapatamayabilir; o durumda kullanıcıya söyler.
import { i18n } from './I18n.js';

export function exitGame() {
  if (!window.confirm(i18n.t('ui.exitConfirm'))) return;
  try {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.exitApp) { App.exitApp(); return; }
  } catch (e) { /* yoksay */ }
  try { window.close(); } catch (e) { /* yoksay */ }
  // Hâlâ açıksa (tarayıcı sekmesi) kullanıcıya haber ver
  setTimeout(() => { try { window.alert(i18n.t('ui.exitBrowser')); } catch (e) { /* yoksay */ } }, 400);
}
