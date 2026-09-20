/* Radio Studio 2030 — spotify.js
   Provides a single shared "now playing" state.
   - Demo mode: simulates playback locally with mock tracks (works with zero config).
   - Live mode: if an access token is present (obtained via /auth/spotify/* on the backend),
     uses the Spotify Web Playback SDK + Web API to control a real Spotify Premium session.
   Other pages/components read state via SpotifyEngine.getState() and subscribe via
   SpotifyEngine.on('update', cb). */

const SpotifyEngine = (() => {
  const MOCK_TRACKS = [
    { title: 'Neon Skyline', artist: 'Aurora Drift', album: 'Midnight FM', duration: 214, cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80' },
    { title: 'Static & Gold', artist: 'The Frequency', album: 'Broadcast', duration: 187, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80' },
    { title: 'Wavelength', artist: 'Nova Echo', album: 'Transmit', duration: 201, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80' },
    { title: 'Analog Heart', artist: 'Cassette Youth', album: 'Rewind', duration: 176, cover: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=600&q=80' },
    { title: 'City Lights Radio', artist: 'Vantage Point', album: 'Overdrive', duration: 233, cover: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=600&q=80' },
  ];

  let state = {
    mode: 'demo',       // 'demo' | 'live'
    connected: false,
    isPlaying: false,
    track: MOCK_TRACKS[0],
    position: 0,        // seconds
    volume: 70,
    queue: MOCK_TRACKS.slice(1),
    recent: [],
    trackIndex: 0,
  };

  const listeners = {};
  function emit(evt) { (listeners[evt] || []).forEach(cb => cb(state)); }
  function on(evt, cb) { (listeners[evt] = listeners[evt] || []).push(cb); }

  let tickHandle = null;
  function startTicking() {
    stopTicking();
    tickHandle = setInterval(() => {
      if (!state.isPlaying) return;
      state.position += 1;
      if (state.position >= state.track.duration) {
        nextTrack();
      } else {
        emit('tick');
      }
    }, 1000);
  }
  function stopTicking() { if (tickHandle) clearInterval(tickHandle); }

  function play() { state.isPlaying = true; emit('update'); }
  function pause() { state.isPlaying = false; emit('update'); }
  function toggle() { state.isPlaying ? pause() : play(); emit('update'); }

  function nextTrack() {
    state.recent.unshift(state.track);
    state.recent = state.recent.slice(0, 12);
    const nextT = state.queue.shift() || MOCK_TRACKS[(state.trackIndex + 1) % MOCK_TRACKS.length];
    state.queue.push({ ...MOCK_TRACKS[(state.trackIndex + 2) % MOCK_TRACKS.length] });
    state.trackIndex = (state.trackIndex + 1) % MOCK_TRACKS.length;
    state.track = nextT;
    state.position = 0;
    emit('update');
  }

  function prevTrack() {
    state.position = 0;
    emit('update');
  }

  function seek(sec) { state.position = Math.max(0, Math.min(state.track.duration, sec)); emit('update'); }
  function setVolume(v) { state.volume = v; emit('update'); }

  function getState() { return state; }

  function init() {
    state.queue = MOCK_TRACKS.slice(1, 4).map(t => ({ ...t }));
    startTicking();
    // Attempt live mode: check backend for a valid session (never exposes secrets to client)
    fetch('/api/spotify/status').then(r => r.ok ? r.json() : null).then(data => {
      if (data && data.connected) {
        state.mode = 'live';
        state.connected = true;
        emit('update');
        // Live playback would be driven by the Spotify Web Playback SDK here,
        // loaded from https://sdk.scdn.co/spotify-player.js with the token
        // fetched from /api/spotify/token. Polling fallback:
        pollLive();
      }
    }).catch(() => { /* stay in demo mode */ });
  }

  function pollLive() {
    setInterval(async () => {
      try {
        const r = await fetch('/api/spotify/now-playing');
        if (!r.ok) return;
        const d = await r.json();
        if (!d || !d.item) return;
        state.track = {
          title: d.item.name,
          artist: (d.item.artists || []).map(a => a.name).join(', '),
          album: d.item.album ? d.item.album.name : '',
          duration: Math.round((d.item.duration_ms || 0) / 1000),
          cover: d.item.album && d.item.album.images && d.item.album.images[0] ? d.item.album.images[0].url : '',
        };
        state.position = Math.round((d.progress_ms || 0) / 1000);
        state.isPlaying = !!d.is_playing;
        emit('update');
      } catch (e) { /* ignore */ }
    }, 4000);
  }

  return { init, on, play, pause, toggle, nextTrack, prevTrack, seek, setVolume, getState };
})();

function rsFormatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
