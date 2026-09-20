/* Radio Studio 2030 — storage.js
   LocalStorage helpers for settings + IndexedDB for uploaded audio blobs. */

const RS_KEYS = {
  station: 'rs_station',
  theme: 'rs_theme',
  hotkeys: 'rs_hotkeys',
  timerState: 'rs_timer_state',
  sounds: 'rs_sounds',       // metadata only (blobs live in IndexedDB)
  showClock: 'rs_show_clock',
  playlist: 'rs_playlist',
  apiConfig: 'rs_api_config', // non-secret, client-safe config only (e.g. city name)
  mixer: 'rs_mixer',
  history: 'rs_history',
};

const RS = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('storage full', e); }
  },
  remove(key) { localStorage.removeItem(key); },
};

/* ---------------- IndexedDB for audio blobs ---------------- */
const RSDB = (() => {
  let dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('radiostudio2030', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('sounds')) db.createObjectStore('sounds', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  return {
    async put(id, blob) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sounds', 'readwrite');
        tx.objectStore('sounds').put({ id, blob });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async get(id) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sounds', 'readonly');
        const req = tx.objectStore('sounds').get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => reject(req.error);
      });
    },
    async delete(id) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sounds', 'readwrite');
        tx.objectStore('sounds').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
})();

function rsToast(msg, ms = 2600) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function rsUid() { return Math.random().toString(36).slice(2, 10); }
