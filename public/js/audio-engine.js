/* Radio Studio 2030 — audio-engine.js
   One shared AudioContext with mixer buses: mic, music, soundboard, aiVoice -> master.
   Ships built-in synthesized placeholder sounds (jingle/bell/applause/etc.) generated
   with oscillators + noise so the soundboard works with zero uploaded files.
   Real uploaded files (via IndexedDB) are played through the same soundboard bus. */

const AudioEngine = (() => {
  let ctx = null;
  const buses = {};
  let micStream = null, micSource = null, micAnalyser = null;
  const listeners = { mixer: [] };

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      buses.master = ctx.createGain();
      buses.master.gain.value = 0.9;
      buses.master.connect(ctx.destination);

      ['mic', 'music', 'soundboard', 'aiVoice'].forEach(name => {
        const g = ctx.createGain();
        const saved = RS.get(RS_KEYS.mixer, {});
        g.gain.value = saved[name] !== undefined ? saved[name] : 0.85;
        g.connect(buses.master);
        buses[name] = g;
      });
    }
    return ctx;
  }

  function setBusVolume(bus, val01) {
    ensureCtx();
    if (buses[bus]) buses[bus].gain.value = val01;
    const saved = RS.get(RS_KEYS.mixer, {});
    saved[bus] = val01;
    RS.set(RS_KEYS.mixer, saved);
  }
  function getBusVolume(bus) {
    const saved = RS.get(RS_KEYS.mixer, {});
    return saved[bus] !== undefined ? saved[bus] : 0.85;
  }
  function setMasterVolume(val01) { ensureCtx(); buses.master.gain.value = val01; }

  /* ---------------- Synth placeholder sounds ---------------- */
  function playSynth(kind, destBus = 'soundboard') {
    ensureCtx();
    const t0 = ctx.currentTime;
    const out = buses[destBus] || buses.master;
    const g = ctx.createGain();
    g.connect(out);

    function tone(freq, start, dur, type = 'sine', peak = 0.5) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      og.gain.setValueAtTime(0, t0 + start);
      og.gain.linearRampToValueAtTime(peak, t0 + start + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
      o.connect(og); og.connect(g);
      o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
    }
    function noiseBurst(start, dur, peak = 0.4) {
      const bufferSize = ctx.sampleRate * dur;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(peak, t0 + start);
      src.connect(ng); ng.connect(g);
      src.start(t0 + start);
    }

    switch (kind) {
      case 'jingle':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.4));
        break;
      case 'applause':
        for (let i = 0; i < 14; i++) noiseBurst(i * 0.05, 0.15, 0.25);
        break;
      case 'bell':
        tone(1318, 0, 1.2, 'sine', 0.5); tone(2636, 0, 1.0, 'sine', 0.2);
        break;
      case 'radioid':
        tone(392, 0, 0.18, 'square', 0.3); tone(523, 0.18, 0.18, 'square', 0.3); tone(659, 0.36, 0.3, 'square', 0.35);
        break;
      case 'hit':
        tone(80, 0, 0.4, 'sawtooth', 0.6); noiseBurst(0, 0.1, 0.3);
        break;
      case 'alert':
        for (let i = 0; i < 3; i++) tone(880, i * 0.25, 0.2, 'square', 0.45);
        break;
      case 'laugh':
        [400, 460, 420, 500, 440].forEach((f, i) => tone(f, i * 0.14, 0.16, 'sine', 0.3));
        break;
      case 'intro':
        tone(261, 0, 0.6, 'sawtooth', 0.3); tone(392, 0.1, 0.6, 'sawtooth', 0.3); tone(523, 0.2, 0.7, 'sawtooth', 0.35);
        break;
      case 'stationid':
        tone(220, 0, 0.5, 'triangle', 0.4); tone(440, 0.3, 0.6, 'triangle', 0.4);
        break;
      case 'effect':
        for (let i = 0; i < 8; i++) tone(200 + i * 90, i * 0.04, 0.08, 'square', 0.25);
        break;
      default:
        tone(440, 0, 0.3, 'sine', 0.4);
    }
    return 1.4; // approx duration for UI
  }

  /* ---------------- Uploaded file playback ---------------- */
  const playingSources = {};
  async function playBlob(id, blob, destBus = 'soundboard') {
    ensureCtx();
    stop(id);
    const arr = await blob.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(buses[destBus] || buses.master);
    src.start();
    playingSources[id] = src;
    src.onended = () => { delete playingSources[id]; };
    return buf.duration;
  }
  function stop(id) {
    if (playingSources[id]) { try { playingSources[id].stop(); } catch (e) {} delete playingSources[id]; }
  }
  function stopAll() { Object.keys(playingSources).forEach(stop); }

  /* ---------------- Microphone ---------------- */
  async function enableMic() {
    ensureCtx();
    if (micStream) return true;
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micSource = ctx.createMediaStreamSource(micStream);
    micAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 512;
    micSource.connect(micAnalyser);
    micSource.connect(buses.mic);
    return true;
  }
  function disableMic() {
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    micSource = null; micAnalyser = null;
  }
  function getMicLevel() {
    if (!micAnalyser) return 0;
    const data = new Uint8Array(micAnalyser.frequencyBinCount);
    micAnalyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return avg / 255;
  }
  function isMicOn() { return !!micStream; }

  return {
    ensureCtx, setBusVolume, getBusVolume, setMasterVolume,
    playSynth, playBlob, stop, stopAll,
    enableMic, disableMic, getMicLevel, isMicOn,
  };
})();
