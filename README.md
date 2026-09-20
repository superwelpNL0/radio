# 📻 Radio Studio 2030

Een moderne, volledig in de browser werkende radio-studio/automation-website: Spotify-speler, live timer, soundboard, AI-nieuws/weer/verkeer met TTS, playlist/queue, mini-mixer, microfoonondersteuning, show clock, hotkeys, en kant-en-klare OBS Browser Source-layouts.

De frontend werkt **direct met demo-data**, zonder dat je ook maar één API-sleutel hoeft in te vullen. Voeg sleutels toe in `.env` om onderdeel voor onderdeel naar live data over te schakelen.

## Inhoud

1. [Installatie](#1-installatie)
2. [Spotify Developer Dashboard instellen](#2-spotify-developer-dashboard-instellen)
3. [Spotify Redirect URI instellen](#3-spotify-redirect-uri-instellen)
4. [API keys configureren](#4-api-keys-configureren)
5. [AI configureren](#5-ai-configureren)
6. [Weather configureren](#6-weather-configureren)
7. [News configureren](#7-news-configureren)
8. [Traffic configureren](#8-traffic-configureren)
9. [Text-to-Speech configureren](#9-text-to-speech-configureren)
10. [OBS Browser Source instellen](#10-obs-browser-source-instellen)
11. [Radio stream instellen](#11-radio-stream-instellen)
12. [Projectstructuur](#12-projectstructuur)
13. [Pagina's](#13-paginas)

---

## 1. Installatie

Vereist: **Node.js 18+**

```bash
npm install
cp .env.example .env
npm start
```

De site draait daarna op `http://localhost:3000`. Zonder ingevulde `.env`-waarden werkt alles direct met demo/mock-data — inclusief Spotify (voorbeeldnummers), nieuws, weer, verkeer en AI-scripts. Er hoeft dus niets betaald te worden om de app te proberen.

> De frontend is puur statische HTML/CSS/JS (`/public`). De Node-backend (`/server/server.js`) is alleen nodig om geheime API-sleutels veilig te verbergen en CORS-beperkte externe API's te proxyen. Je kunt de map `/public` ook los hosten als je geen backend-functies (Spotify OAuth, AI, TTS) nodig hebt.

## 2. Spotify Developer Dashboard instellen

1. Ga naar [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) en log in met je Spotify-account (Premium vereist voor afspelen via de Web Playback SDK).
2. Klik op **Create app**.
3. Vul een naam en beschrijving in.
4. Kopieer de **Client ID** en **Client Secret** naar je `.env`-bestand (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`).

## 3. Spotify Redirect URI instellen

1. Ga in het Dashboard naar **Edit Settings** van je app.
2. Voeg bij **Redirect URIs** exact deze URL toe (pas het domein aan bij productie):
   ```
   http://localhost:3000/auth/spotify/callback
   ```
3. Zet dezelfde waarde in `.env` bij `SPOTIFY_REDIRECT_URI`.
4. Klik op **Save**.
5. Ga in de app naar `/spotify.html` en klik op **Verbind met Spotify** om de OAuth-koppeling te testen.

## 4. API keys configureren

Alle sleutels staan in `.env` (zie `.env.example`). Niets wordt ooit naar de browser gestuurd — elke frontend-aanroep gaat via een backend-route (`/api/...`) die de sleutel serverside gebruikt.

## 5. AI configureren

Gebruikt voor het schrijven van nieuws-, weer-, verkeer- en "AI-uur"-scripts.

1. Vraag een API-sleutel aan bij je gekozen AI-provider (de backend is voorbereid op de Anthropic Claude API, maar je kunt `server/server.js` → `/api/ai/script` aanpassen voor een andere provider).
2. Zet de sleutel in `.env` bij `AI_API_KEY`.
3. Zonder sleutel genereert de app nette demo-scripts op basis van sjablonen, zodat de knoppen altijd werken.

## 6. Weather configureren

1. Maak een gratis account bij bijvoorbeeld [OpenWeatherMap](https://openweathermap.org/api).
2. Zet de sleutel in `.env` bij `WEATHER_API_KEY`.
3. Stel de standaardlocatie in via **Instellingen → Locaties** in de app (standaard: Leeuwarden).

## 7. News configureren

1. Maak een account bij een nieuws-API naar keuze (bijvoorbeeld [NewsAPI.org](https://newsapi.org)).
2. Zet de sleutel in `.env` bij `NEWS_API_KEY`.
3. De backend-route `/api/news` haalt koppen op en levert deze aan de AI-scriptgenerator.

## 8. Traffic configureren

1. De backend heeft een kant-en-klaar integratiepunt in `server/server.js` (`/api/traffic`) voor een provider zoals TomTom Traffic API of NDW (Nationale Databank Wegverkeersgegevens).
2. Zet je sleutel in `.env` bij `TRAFFIC_API_KEY` en vul de daadwerkelijke API-aanroep aan op de aangegeven plek in de code.
3. Zonder sleutel toont de app realistische demo-filegegevens.

## 9. Text-to-Speech configureren

1. Kies een TTS-provider (bijvoorbeeld ElevenLabs of Google Cloud Text-to-Speech).
2. Zet de sleutel in `.env` bij `TTS_API_KEY` en implementeer de aanroep in `server/server.js` → `/api/tts` (een voorbeeld-implementatie voor ElevenLabs staat als commentaar in de code).
3. Zonder sleutel valt de app automatisch terug op de **ingebouwde spraaksynthese van de browser** (`speechSynthesis`), zodat "voorlezen" altijd werkt, ook zonder configuratie.

## 10. OBS Browser Source instellen

De app heeft kant-en-klare, "chrome-loze" (geen bediening zichtbaar) pagina's speciaal voor OBS:

| Layout | URL | Aanbevolen afmeting |
|---|---|---|
| Fullscreen | `/obs.html?layout=fullscreen` | 1920×1080 |
| Now Playing | `/obs-now-playing.html` | 900×160 |
| Timer | `/obs-timer.html` | 500×220 |
| Radio Overlay | `/obs.html?layout=overlay` | 500×200 (rechtsonder plaatsen) |

Instellen in OBS Studio:

1. Voeg een nieuwe bron toe → **Browser**.
2. Plak de gewenste URL (zie tabel, of open `/obs.html` in de app voor kant-en-klare links).
3. Stel de breedte/hoogte in zoals hierboven aanbevolen.
4. Vink **"Shutdown source when not visible"** en **"Refresh browser when scene becomes active"** *uit*, zodat klok en audio-status doorlopen.
5. De now-playing-, timer- en overlay-layouts hebben een transparante achtergrond — geen chroma key nodig.

## 11. Radio stream instellen

De website is **geen** streamserver — hij is ontworpen om te werken náást een bestaande Icecast/Shoutcast-achtige stream.

1. Ga naar **Instellingen** in de app.
2. Vul bij **Stream** de directe stream-URL in (bijvoorbeeld `https://stream.jouwradio.nl/live`).
3. Klik op **Status controleren**. De backend-route `/api/stream/status` probeert de stream te bereiken en toont 🟢 ONLINE of 🔴 OFFLINE.
4. Browsers kunnen door CORS soms niet rechtstreeks bij een externe stream. Gebruik in dat geval de backend als proxy, of zet `STREAM_URL` in `.env` zodat de statuscheck altijd serverside gebeurt.

## 12. Projectstructuur

```
radiostudio/
├── public/                 # Volledig statische frontend
│   ├── index.html          # Redirect → studio.html
│   ├── studio.html         # Hoofd-console (Spotify, mixer, mic, timer, quick sounds)
│   ├── dashboard.html       # Uitzendoverzicht
│   ├── spotify.html         # Volledige Spotify-speler + koppeling
│   ├── soundboard.html      # Soundboard + upload/beheer
│   ├── timer.html           # Grote live timer
│   ├── playlist.html        # Wachtrij / queue
│   ├── ai.html               # Automatisch AI-uur + scheduler
│   ├── news.html             # AI-nieuwsbulletin + TTS
│   ├── weather.html          # Weerbericht + script
│   ├── traffic.html          # Verkeersbericht + script
│   ├── obs.html               # OBS-layoutkiezer + fullscreen/overlay
│   ├── obs-now-playing.html   # OBS Browser Source
│   ├── obs-timer.html         # OBS Browser Source
│   ├── settings.html          # Branding, hotkeys, locaties, show clock
│   ├── css/style.css          # Design system (dark, glassmorphism, neon accenten)
│   └── js/                    # Modulaire client-logica (storage, shell, spotify, timer, audio, soundboard)
├── server/server.js           # Express-backend: OAuth + API-proxy + demo-fallbacks
├── package.json
├── .env.example
└── README.md
```

## 13. Pagina's

`/` (→ studio) · `/studio.html` · `/dashboard.html` · `/soundboard.html` · `/spotify.html` · `/timer.html` · `/ai.html` · `/news.html` · `/weather.html` · `/traffic.html` · `/playlist.html` · `/settings.html` · `/obs.html` · `/obs-now-playing.html` · `/obs-timer.html`

---

### Hotkeys (standaard, aanpasbaar in Instellingen)

| Toets | Actie |
|---|---|
| `Space` | Play/Pause |
| `N` | Volgend nummer |
| `M` | Microfoon aan/uit |
| `1`–`9` | Soundboard-pads |
| `Esc` | Stop alle geluiden |

### Lokale opslag

Alle instellingen, sounds, hotkeys, show clock en API-configuratie (niet-geheim, bv. plaatsnaam) worden bewaard in `LocalStorage`/`IndexedDB` van de browser — niets verlaat je apparaat behalve de expliciete API-aanroepen naar de backend.
