// ============================================================
// Net.js - Sunucu bağlantısı (WebSocket) ve lobi işlemleri
// ============================================================
// Oyun sunucudan açıldıysa (http://...) aynı adrese bağlanır. Tek dosya HTML / exe / apk
// gibi dosyadan açıldıysa Ayarlar'daki "Sunucu adresi" kullanılır.
//   net.connect()              net.on('room', fn) / net.off(...)
//   net.list() create(opts) join(code) leave() setFlag(f) roomSettings(o) start(setup) end()
//   net.relay(data, to?)       -> odadakilere (ya da 'host'a / tek kişiye) mesaj
// Gelen mesaj türleri: hello, list, joined, room, left, start, relay, playerLeft, hostLeft, error, status, account, matchReward
const SERVER_KEY = 'cfs.server';
const PROFILE_KEY = 'cfs.profile';
const TOKEN_KEY = 'cfs.token';

class Net {
  constructor() {
    this.ws = null;
    this.id = null;
    this.room = null;
    this.status = 'off';            // off | connecting | online | error
    this.handlers = {};
    this.queue = [];
    this.retry = 0;
    this.profile = { name: '', flag: 'TR', hat: 'none' };
    this.account = null;           // { name, level, xp, xpInto, xpNeed, title, stats } giriş yapıldıysa (sunucu hesaplar)
    this.lastReward = null;        // son maçın ödülü (sunucudan 'matchReward')
    try { this.token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { this.token = ''; }
    try { Object.assign(this.profile, JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch (e) { /* yoksay */ }
  }

  get isHost() { return !!(this.room && this.id && this.room.hostId === this.id); }
  get inRoom() { return !!this.room; }

  on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); return fn; }
  off(t, fn) { const h = this.handlers[t]; if (h) { const i = h.indexOf(fn); if (i >= 0) h.splice(i, 1); } }
  emit(t, m) { (this.handlers[t] || []).slice().forEach((fn) => { try { fn(m); } catch (e) { console.error(e); } }); }

  static serverSetting() { try { return localStorage.getItem(SERVER_KEY) || ''; } catch (e) { return ''; } }
  static setServerSetting(v) { try { localStorage.setItem(SERVER_KEY, v || ''); } catch (e) { /* yoksay */ } }

  // ws(s)://adres/ws
  url() {
    const saved = Net.serverSetting().trim();
    if (saved) {
      let u = saved.replace(/\/+$/, '');
      if (!/^\w+:\/\//.test(u)) u = 'https://' + u;
      return u.replace(/^http/, 'ws') + '/ws';
    }
    if (location.protocol === 'http:' || location.protocol === 'https:') return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return null;
  }

  setProfile(name, flag) {
    if (name !== undefined) this.profile.name = String(name || '').slice(0, 16);
    if (flag !== undefined) this.profile.flag = flag;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); } catch (e) { /* yoksay */ }
    this.send({ t: 'profile', ...this.profile });
  }

  // Hile koruması tetiklendi: bağlantıyı kes, bir daha bağlanma
  block() { this.blocked = true; this.queue = []; if (this.ws) { try { this.ws.close(); } catch (e) { /* yoksay */ } } this.room = null; }

  connect() {
    if (this.blocked) return false;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return true;
    const url = this.url();
    if (!url) { this.setStatus('noServer'); return false; }
    this.setStatus('connecting');
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.setStatus('error'); return false; }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('online');
      this.send({ t: 'profile', ...this.profile });
      if (this.token) this.send({ t: 'auth', token: this.token });
      const q = this.queue; this.queue = [];
      q.forEach((m) => this.send(m));
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'hello') this.id = m.id;
      if (m.t === 'account') {
        this.account = m.account;
        if (m.token) { this.token = m.token; try { localStorage.setItem(TOKEN_KEY, m.token); } catch (e) { /* yoksay */ } }
        if (m.account) { this.profile.name = m.account.name; try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); } catch (e) { /* yoksay */ } }
      }
      if (m.t === 'authError' && m.code === 'expired') { this.token = ''; try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* yoksay */ } }
      if (m.t === 'matchReward') { this.account = m.account; this.lastReward = m; }
      if (m.t === 'joined') { this.id = m.you; this.room = m.room; }
      if (m.t === 'room') this.room = m.room;
      if (m.t === 'left') this.room = null;
      this.emit(m.t, m);
    };
    ws.onclose = () => {
      const hadRoom = !!this.room;
      this.ws = null; this.room = null;
      this.setStatus('error');
      if (hadRoom) this.emit('disconnected', {});
    };
    ws.onerror = () => {};
    return true;
  }

  setStatus(s) { this.status = s; this.emit('status', { status: s }); }

  send(m) {
    if (this.blocked) return;
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'relay') { this.queue.push(m); this.connect(); }
  }

  register(name, pass) { this.send({ t: 'register', name, pass }); }
  login(name, pass) { this.send({ t: 'login', name, pass }); }
  logout() {
    this.send({ t: 'logout', token: this.token });
    this.token = ''; this.account = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* yoksay */ }
  }
  list() { this.send({ t: 'list' }); }
  create(opts) { this.send({ t: 'create', ...opts }); }
  join(code) { this.send({ t: 'join', code: String(code || '').trim().toUpperCase() }); }
  leave() { if (this.room) this.send({ t: 'leave' }); this.room = null; }
  buyHat(hat) { this.send({ t: 'buyHat', hat }); }
  setHat(hat) { this.profile.hat = hat; this.setProfile(); this.send({ t: 'setHat', hat }); }
  setFlag(flag) { this.profile.flag = flag; this.setProfile(undefined, flag); this.send({ t: 'setFlag', flag }); }
  roomSettings(o) { this.send({ t: 'roomSettings', ...o }); }
  start(setup) { this.send({ t: 'start', setup }); }
  end() { this.send({ t: 'end' }); }
  // Host: maç bitti. stats = [{ id, tasks, kills }] -> sunucu istatistik ve XP yazar, herkese 'matchReward' gönderir
  matchResult(winner, stats) { this.send({ t: 'matchResult', winner, stats }); }
  chat(text, ch = 'lobby', dead = false) { this.send({ t: 'chat', text, ch, dead }); }
  relay(d, to) { if (!this.blocked && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'relay', d, to })); }
}

export const net = new Net();
export { Net };
