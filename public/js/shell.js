/* Radio Studio 2030 — shell.js
   Builds the left rail + topbar shared across all non-OBS pages. */

const RS_NAV = [
  { href: 'studio.html', icon: '🎛️', label: 'Studio' },
  { href: 'dashboard.html', icon: '📡', label: 'Dashboard' },
  { href: 'spotify.html', icon: '🎧', label: 'Spotify' },
  { href: 'soundboard.html', icon: '🔊', label: 'Soundboard' },
  { href: 'timer.html', icon: '⏱️', label: 'Timer' },
  { href: 'playlist.html', icon: '📋', label: 'Playlist' },
  { href: 'ai.html', icon: '🤖', label: 'AI Uur' },
  { href: 'news.html', icon: '📰', label: 'Nieuws' },
  { href: 'weather.html', icon: '🌦️', label: 'Weer' },
  { href: 'traffic.html', icon: '🚗', label: 'Verkeer' },
  { href: 'obs.html', icon: '📺', label: 'OBS' },
  { href: 'settings.html', icon: '⚙️', label: 'Instellingen' },
];

function rsStation() {
  return RS.get(RS_KEYS.station, {
    name: 'Radio Studio 2030',
    logo: '📻',
    accent: '#e8a54b',
    show: 'Middagshow',
    presenter: 'DJ Nova',
    streamUrl: '',
    streamOnline: false,
    listeners: 1284,
  });
}

function rsBuildShell(activeHref) {
  const station = rsStation();
  document.documentElement.style.setProperty('--amber', station.accent || '#e8a54b');
  const theme = RS.get(RS_KEYS.theme, 'dark');
  if (theme === 'light') document.body.setAttribute('data-theme', 'light');

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const rail = document.createElement('nav');
  rail.className = 'rail';
  rail.innerHTML = `
    <div class="rail-logo">${station.logo || '📻'}</div>
    ${RS_NAV.map(item => `
      <a class="rail-link ${item.href === activeHref ? 'active' : ''}" href="${item.href}">
        ${item.icon}
        <span class="tip">${item.label}</span>
      </a>`).join('')}
    <div class="rail-spacer"></div>
    <div class="rail-air ${station.streamOnline ? '' : 'off'}" id="railAir">${station.streamOnline ? 'LIVE' : 'OFF'}</div>
  `;

  const main = document.createElement('div');
  main.className = 'main';
  main.id = 'rsMain';

  shell.appendChild(rail);
  shell.appendChild(main);
  document.body.insertBefore(shell, document.body.firstChild);

  return main;
}

function rsBuildTopbar(main, title, sub) {
  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML = `
    <div>
      <h1>${title}</h1>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
    </div>
    <div class="topbar-spacer"></div>
    <div class="topbar-listeners"><span class="dot" style="color:var(--cyan)"></span><span id="rsListeners">–</span> luisteraars</div>
    <div class="topbar-clock mono" id="rsClock">--:--:--</div>
    <button class="btn btn-icon" id="rsThemeBtn" title="Thema wisselen">🌓</button>
  `;
  main.appendChild(bar);

  const content = document.createElement('div');
  content.className = 'content';
  content.id = 'rsContent';
  main.appendChild(content);

  const clockEl = bar.querySelector('#rsClock');
  function tick() {
    const d = new Date();
    clockEl.textContent = d.toLocaleTimeString('nl-NL');
  }
  tick();
  setInterval(tick, 1000);

  const listenersEl = bar.querySelector('#rsListeners');
  const station = rsStation();
  let listeners = station.listeners || 1200;
  listenersEl.textContent = listeners.toLocaleString('nl-NL');
  setInterval(() => {
    listeners += Math.round((Math.random() - 0.45) * 8);
    listeners = Math.max(20, listeners);
    listenersEl.textContent = listeners.toLocaleString('nl-NL');
  }, 4000);

  bar.querySelector('#rsThemeBtn').addEventListener('click', () => {
    const cur = RS.get(RS_KEYS.theme, 'dark');
    const next = cur === 'light' ? 'dark' : 'light';
    RS.set(RS_KEYS.theme, next);
    if (next === 'light') document.body.setAttribute('data-theme', 'light');
    else document.body.removeAttribute('data-theme');
  });

  return content;
}

/** Call at top of every non-OBS page. Returns the #rsContent element to render into. */
function rsInitPage(activeHref, title, sub) {
  const main = rsBuildShell(activeHref);
  const content = rsBuildTopbar(main, title, sub);
  rsInitHotkeys();
  return content;
}

/* ---------------- Global hotkeys ---------------- */
function rsInitHotkeys() {
  const keys = RS.get(RS_KEYS.hotkeys, RS_DEFAULT_HOTKEYS);
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (k === keys.playPause) { e.preventDefault(); window.dispatchEvent(new CustomEvent('rs:playpause')); }
    else if (k === keys.next) { window.dispatchEvent(new CustomEvent('rs:next')); }
    else if (k === keys.mic) { window.dispatchEvent(new CustomEvent('rs:mic')); }
    else if (k === keys.stopSound) { window.dispatchEvent(new CustomEvent('rs:stopsound')); }
    else if (/^[1-9]$/.test(k)) { window.dispatchEvent(new CustomEvent('rs:pad', { detail: Number(k) - 1 })); }
  });
}

const RS_DEFAULT_HOTKEYS = {
  playPause: ' ',
  next: 'N',
  mic: 'M',
  soundboard: 'S',
  timer: 'T',
  jingle: 'B',
  stopSound: 'Escape',
};
