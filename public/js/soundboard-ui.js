/* Radio Studio 2030 — soundboard-ui.js */

const RS_DEFAULT_PADS = [
  { id: 'jingle', name: 'JINGLE', emoji: '🎺', synth: 'jingle', key: 'F1' },
  { id: 'applaus', name: 'APPLAUS', emoji: '👏', synth: 'applause', key: 'F2' },
  { id: 'bell', name: 'BELL', emoji: '🔔', synth: 'bell', key: 'F3' },
  { id: 'radioid', name: 'RADIO ID', emoji: '📻', synth: 'radioid', key: 'F4' },
  { id: 'hit', name: 'HIT', emoji: '🔥', synth: 'hit', key: 'F5' },
  { id: 'alert', name: 'ALERT', emoji: '🚨', synth: 'alert', key: 'F6' },
  { id: 'laugh', name: 'LAUGH', emoji: '😂', synth: 'laugh', key: 'F7' },
  { id: 'intro', name: 'INTRO', emoji: '🎵', synth: 'intro', key: 'F8' },
  { id: 'stationid', name: 'STATION ID', emoji: '🎙️', synth: 'stationid', key: 'F9' },
  { id: 'effect', name: 'EFFECT', emoji: '💥', synth: 'effect', key: 'F10' },
];

function rsGetSounds() {
  let sounds = RS.get(RS_KEYS.sounds, null);
  if (!sounds) {
    sounds = RS_DEFAULT_PADS.map(p => ({ ...p, custom: false, volume: 1 }));
    RS.set(RS_KEYS.sounds, sounds);
  }
  return sounds;
}
function rsSaveSounds(sounds) { RS.set(RS_KEYS.sounds, sounds); }

function rsRenderSoundboard(container, opts = {}) {
  const compact = !!opts.compact;
  const sounds = rsGetSounds();
  container.innerHTML = '';
  container.className = 'sound-grid';

  const activePads = {};

  sounds.forEach((sound, idx) => {
    const pad = document.createElement('div');
    pad.className = 'sound-pad';
    pad.dataset.id = sound.id;
    pad.innerHTML = `
      <span class="key">${sound.key || ''}</span>
      <span class="emoji">${sound.emoji || '🔊'}</span>
      <span class="name">${sound.name}</span>
      <div class="wave">${Array.from({ length: 14 }).map(() => '<i></i>').join('')}</div>
    `;
    pad.addEventListener('click', () => rsTriggerPad(sound, pad));
    if (!compact) {
      pad.draggable = true;
      pad.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', String(idx)));
      pad.addEventListener('dragover', e => e.preventDefault());
      pad.addEventListener('drop', e => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData('text/plain'));
        const arr = rsGetSounds();
        const [moved] = arr.splice(from, 1);
        arr.splice(idx, 0, moved);
        rsSaveSounds(arr);
        rsRenderSoundboard(container, opts);
      });
    }
    container.appendChild(pad);
    activePads[sound.id] = pad;
  });

  if (!compact) {
    const addPad = document.createElement('div');
    addPad.className = 'sound-pad sound-pad-add';
    addPad.innerHTML = `<span class="emoji">➕</span><span class="name">Sound toevoegen</span>`;
    addPad.addEventListener('click', () => document.getElementById('rsSoundUpload')?.click());
    container.appendChild(addPad);
  }

  window.addEventListener('rs:pad', (e) => {
    const s = rsGetSounds()[e.detail];
    if (s) rsTriggerPad(s, activePads[s.id]);
  });
  window.addEventListener('rs:stopsound', () => {
    AudioEngine.stopAll();
    container.querySelectorAll('.sound-pad.playing').forEach(p => p.classList.remove('playing'));
  });
}

const rsPlayingPadIds = new Set();

async function rsTriggerPad(sound, padEl) {
  const isPlaying = rsPlayingPadIds.has(sound.id);
  if (isPlaying) {
    AudioEngine.stop(sound.id);
    rsPlayingPadIds.delete(sound.id);
    padEl && padEl.classList.remove('playing');
    return;
  }
  padEl && padEl.classList.add('playing');
  rsPlayingPadIds.add(sound.id);
  let duration = 1.2;
  try {
    if (sound.custom) {
      const blob = await RSDB.get(sound.id);
      if (blob) duration = await AudioEngine.playBlob(sound.id, blob, 'soundboard');
      else duration = AudioEngine.playSynth(sound.synth || 'effect');
    } else {
      duration = AudioEngine.playSynth(sound.synth || 'effect');
    }
  } catch (e) {
    rsToast('Kon geluid niet afspelen: ' + e.message);
  }
  setTimeout(() => { rsPlayingPadIds.delete(sound.id); padEl && padEl.classList.remove('playing'); }, duration * 1000);
}

function rsInitSoundUpload(inputEl, container, opts) {
  inputEl.addEventListener('change', async () => {
    const file = inputEl.files[0];
    if (!file) return;
    const id = rsUid();
    await RSDB.put(id, file);
    const sounds = rsGetSounds();
    sounds.push({ id, name: file.name.replace(/\.[^/.]+$/, '').slice(0, 20).toUpperCase(), emoji: '🎵', custom: true, key: '' });
    rsSaveSounds(sounds);
    rsRenderSoundboard(container, opts);
    rsToast('Geluid toegevoegd: ' + file.name);
    inputEl.value = '';
  });

  container.addEventListener('dragover', e => { e.preventDefault(); });
  container.addEventListener('drop', async e => {
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('audio/'));
    if (!files.length) return;
    e.preventDefault();
    for (const file of files) {
      const id = rsUid();
      await RSDB.put(id, file);
      const sounds = rsGetSounds();
      sounds.push({ id, name: file.name.replace(/\.[^/.]+$/, '').slice(0, 20).toUpperCase(), emoji: '🎵', custom: true, key: '' });
      rsSaveSounds(sounds);
    }
    rsRenderSoundboard(container, opts);
    rsToast(files.length + ' geluid(en) toegevoegd');
  });
}
