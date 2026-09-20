/**
 * Radio Studio 2030 — backend API layer
 * -------------------------------------
 * Serves the static frontend from /public and proxies calls to external
 * services (Spotify, news, weather, traffic, AI, TTS) so that secret API
 * keys never reach the browser. Every route degrades gracefully to demo /
 * mock data when the relevant environment variable is not configured, so
 * the app is fully usable out of the box with zero paid API keys.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

/* -------------------------------------------------------------------- */
/*  Config status — tells the frontend which integrations are "live"    */
/* -------------------------------------------------------------------- */
app.get('/api/config/status', (req, res) => {
  res.json({
    spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    news: !!process.env.NEWS_API_KEY,
    weather: !!process.env.WEATHER_API_KEY,
    traffic: !!process.env.TRAFFIC_API_KEY,
    ai: !!process.env.AI_API_KEY,
    tts: !!process.env.TTS_API_KEY,
  });
});

/* -------------------------------------------------------------------- */
/*  Spotify OAuth + playback proxy                                      */
/* -------------------------------------------------------------------- */
const SPOTIFY_SCOPES = [
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'streaming', 'user-read-email', 'user-read-private',
].join(' ');

// In-memory token store (single-user studio app). For multi-user setups, use a real session store.
let spotifyTokens = null; // { access_token, refresh_token, expires_at }

app.get('/auth/spotify/login', (req, res) => {
  if (!process.env.SPOTIFY_CLIENT_ID) {
    return res.status(400).send('Spotify is niet geconfigureerd. Zet SPOTIFY_CLIENT_ID en SPOTIFY_CLIENT_SECRET in .env — zie README.');
  }
  const state = crypto.randomBytes(8).toString('hex');
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${BASE_URL}/auth/spotify/callback`;
  const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  }).toString();
  res.redirect(url);
});

app.get('/auth/spotify/callback', async (req, res) => {
  const { code } = req.query;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${BASE_URL}/auth/spotify/callback`;
  try {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });
    const data = await resp.json();
    if (data.access_token) {
      spotifyTokens = { ...data, expires_at: Date.now() + data.expires_in * 1000 };
      res.redirect('/spotify.html?connected=1');
    } else {
      res.status(400).send('Spotify-koppeling mislukt: ' + JSON.stringify(data));
    }
  } catch (e) {
    res.status(500).send('Fout bij koppelen: ' + e.message);
  }
});

async function getValidSpotifyToken() {
  if (!spotifyTokens) return null;
  if (Date.now() < spotifyTokens.expires_at - 30000) return spotifyTokens.access_token;
  // refresh
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: spotifyTokens.refresh_token }),
  });
  const data = await resp.json();
  if (data.access_token) {
    spotifyTokens = { ...spotifyTokens, ...data, expires_at: Date.now() + data.expires_in * 1000 };
    return spotifyTokens.access_token;
  }
  return null;
}

app.get('/api/spotify/status', async (req, res) => {
  res.json({ connected: !!spotifyTokens });
});

app.get('/api/spotify/token', async (req, res) => {
  const token = await getValidSpotifyToken();
  if (!token) return res.status(401).json({ error: 'not_connected' });
  res.json({ access_token: token });
});

app.get('/api/spotify/now-playing', async (req, res) => {
  const token = await getValidSpotifyToken();
  if (!token) return res.status(401).json({ error: 'not_connected' });
  try {
    const resp = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 204) return res.json({});
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/spotify/control', async (req, res) => {
  const token = await getValidSpotifyToken();
  if (!token) return res.status(401).json({ error: 'not_connected' });
  const { action } = req.body; // 'play' | 'pause' | 'next' | 'previous'
  const endpointMap = {
    play: { method: 'PUT', path: '/me/player/play' },
    pause: { method: 'PUT', path: '/me/player/pause' },
    next: { method: 'POST', path: '/me/player/next' },
    previous: { method: 'POST', path: '/me/player/previous' },
  };
  const ep = endpointMap[action];
  if (!ep) return res.status(400).json({ error: 'unknown_action' });
  try {
    await fetch(`https://api.spotify.com${ep.path}`, { method: ep.method, headers: { Authorization: `Bearer ${token}` } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------------------------------------------------------------------- */
/*  News                                                                 */
/* -------------------------------------------------------------------- */
const DEMO_ARTICLES = [
  { title: 'Nieuwe fietsbrug in gebruik genomen na jaren van voorbereiding', source: 'Regionaal Nieuws' },
  { title: 'Economie groeit sterker dan verwacht in laatste kwartaal', source: 'Nationaal Nieuws' },
  { title: 'Lokale ondernemers openen duurzame marktplaats in centrum', source: 'Stadsjournaal' },
  { title: 'Weerinstituut waarschuwt voor wisselvallig weekend', source: 'Weerbericht NL' },
];

app.get('/api/news', async (req, res) => {
  const category = req.query.category || 'algemeen';
  if (!process.env.NEWS_API_KEY) {
    return res.json({ demo: true, category, articles: DEMO_ARTICLES });
  }
  try {
    const url = `https://newsapi.org/v2/top-headlines?country=nl&category=${encodeURIComponent(category === 'algemeen' ? 'general' : category)}&apiKey=${process.env.NEWS_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const articles = (data.articles || []).slice(0, 6).map(a => ({ title: a.title, source: a.source && a.source.name }));
    res.json({ demo: false, category, articles: articles.length ? articles : DEMO_ARTICLES });
  } catch (e) {
    res.json({ demo: true, category, articles: DEMO_ARTICLES, error: e.message });
  }
});

/* -------------------------------------------------------------------- */
/*  Weather                                                              */
/* -------------------------------------------------------------------- */
app.get('/api/weather', async (req, res) => {
  const city = req.query.city || 'Leeuwarden';
  if (!process.env.WEATHER_API_KEY) {
    const temp = Math.round(8 + Math.random() * 10);
    const demo = {
      demo: true, city, temp, feelsLike: temp - 2, rainChance: Math.round(Math.random() * 60),
      windSpeed: Math.round(10 + Math.random() * 20), windDir: 'ZW',
      todayDesc: 'Wisselend bewolkt', tomorrowDesc: 'Kans op regen',
    };
    demo.script = `En dan het weer. In ${city} is het momenteel ${demo.temp} graden, wat aanvoelt als ${demo.feelsLike} graden. Er is ${demo.rainChance} procent kans op regen, met wind uit het ${demo.windDir} rond de ${demo.windSpeed} kilometer per uur. Vandaag: ${demo.todayDesc.toLowerCase()}. Morgen: ${demo.tomorrowDesc.toLowerCase()}.`;
    return res.json(demo);
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&lang=nl&appid=${process.env.WEATHER_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const now = data.list[0];
    const tomorrow = data.list[8] || data.list[data.list.length - 1];
    const result = {
      demo: false, city,
      temp: Math.round(now.main.temp), feelsLike: Math.round(now.main.feels_like),
      rainChance: Math.round((now.pop || 0) * 100),
      windSpeed: Math.round(now.wind.speed * 3.6), windDir: 'variabel',
      todayDesc: now.weather[0].description, tomorrowDesc: tomorrow.weather[0].description,
    };
    result.script = `En dan het weer. In ${city} is het momenteel ${result.temp} graden, wat aanvoelt als ${result.feelsLike} graden. Vandaag: ${result.todayDesc}. Morgen: ${result.tomorrowDesc}.`;
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------------------------------------------------------------------- */
/*  Traffic                                                              */
/* -------------------------------------------------------------------- */
app.get('/api/traffic', async (req, res) => {
  const region = req.query.region || 'Nederland';
  if (!process.env.TRAFFIC_API_KEY) {
    const jams = Math.random() > 0.3 ? [
      { road: 'A2 richting Amsterdam', delay: '+12 min', description: 'File door druk verkeer ter hoogte van Utrecht' },
      { road: 'A12 richting Den Haag', delay: '+7 min', description: 'Vertraging door wegwerkzaamheden' },
    ] : [];
    return res.json({
      demo: true, region, jams,
      script: jams.length
        ? `Dan het verkeer. Op verschillende plaatsen in ${region} zijn momenteel vertragingen. ${jams.map(j => `Op de ${j.road} is er ${j.delay} vertraging.`).join(' ')}`
        : `Dan het verkeer. Op dit moment zijn er geen noemenswaardige files in ${region}. Het verkeer stroomt goed door.`,
    });
  }
  // Real traffic API integration point — plug in a provider such as TomTom or NDW here.
  try {
    res.json({ demo: false, region, jams: [], script: `Dan het verkeer in ${region}.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------------------------------------------------------------------- */
/*  AI script generation                                                 */
/* -------------------------------------------------------------------- */
function demoNewsScript(style, articles) {
  const list = (articles || DEMO_ARTICLES).slice(0, style === 'kort' ? 2 : style === 'uitgebreid' ? 5 : 3);
  const intro = style === 'breaking'
    ? 'We onderbreken dit programma voor een breaking news update.'
    : 'Goedemiddag! Dit is het laatste nieuws van vandaag.';
  const body = list.map(a => `${a.title}.`).join(' ');
  const outro = style === 'kort' ? '' : ' Meer nieuws hoort u later dit uur, hier op de radio.';
  return `${intro} ${body}${outro}`.trim();
}

app.post('/api/ai/script', async (req, res) => {
  const { type, style, articles } = req.body;
  if (!process.env.AI_API_KEY) {
    return res.json({ demo: true, script: demoNewsScript(style, articles) });
  }
  try {
    const prompt = `Schrijf een ${style} Nederlands radionieuwsbulletin op basis van deze koppen: ${(articles || []).map(a => a.title).join(' | ')}. Schrijf het uit alsof een presentator het live voorleest, kort en natuurlijk.`;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.AI_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await resp.json();
    const script = (data.content || []).map(b => b.text || '').join('\n').trim() || demoNewsScript(style, articles);
    res.json({ demo: false, script });
  } catch (e) {
    res.json({ demo: true, script: demoNewsScript(style, articles), error: e.message });
  }
});

app.post('/api/ai/hour', async (req, res) => {
  const { news, weather, traffic } = req.body;
  const intro = `Goed bezig, u luistert naar Radio Studio 2030. Hier is uw update.`;
  const newsPart = demoNewsScript('normaal', news && news.articles);
  const weatherPart = (weather && weather.script) || '';
  const trafficPart = (traffic && traffic.script) || '';
  const outro = `Dat was het overzicht. Blijf luisteren, hier op Radio Studio 2030.`;
  const script = [intro, 'NIEUWS: ' + newsPart, 'WEER: ' + weatherPart, 'VERKEER: ' + trafficPart, outro].join('\n\n');
  res.json({ demo: !process.env.AI_API_KEY, script });
});

/* -------------------------------------------------------------------- */
/*  Text-to-Speech                                                       */
/* -------------------------------------------------------------------- */
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!process.env.TTS_API_KEY) {
    // No server-side TTS configured — tell the frontend to fall back to the
    // browser's built-in speechSynthesis API so the feature still works.
    return res.json({ demo: true, useBrowserTTS: true });
  }
  try {
    // Integration point for a provider such as ElevenLabs or Google Cloud TTS.
    // Example (ElevenLabs-style) — replace with your provider's exact request shape:
    // const resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID', {
    //   method: 'POST',
    //   headers: { 'xi-api-key': process.env.TTS_API_KEY, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ text }),
    // });
    // const buffer = Buffer.from(await resp.arrayBuffer());
    // res.set('Content-Type', 'audio/mpeg'); return res.send(buffer);
    res.json({ demo: true, useBrowserTTS: true, note: 'Configureer een TTS-provider in server.js /api/tts' });
  } catch (e) {
    res.json({ demo: true, useBrowserTTS: true, error: e.message });
  }
});

/* -------------------------------------------------------------------- */
/*  Stream status                                                        */
/* -------------------------------------------------------------------- */
app.get('/api/stream/status', async (req, res) => {
  const url = req.query.url || process.env.STREAM_URL;
  if (!url) return res.json({ online: false, reason: 'no_url_configured' });
  try {
    const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(4000) });
    res.json({ online: resp.ok });
  } catch (e) {
    res.json({ online: false, reason: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Radio Studio 2030 draait op ${BASE_URL}`);
  console.log('Demo-modus actief voor elke integratie zonder API-sleutel in .env');
});
