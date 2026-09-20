/* Radio Studio 2030 — timer.js
   Shared timer engine: countdown, stopwatch, segment timer. Persists across reloads. */

const TimerEngine = (() => {
  let state = RS.get(RS_KEYS.timerState, {
    mode: 'countdown',   // 'countdown' | 'stopwatch' | 'segment'
    remaining: 180,       // seconds, for countdown/segment
    elapsed: 0,            // seconds, for stopwatch
    running: false,
    segmentLabel: 'VOLGEND ITEM',
    warnAt: 30,
    dangerAt: 10,
  });

  const listeners = [];
  function emit() { RS.set(RS_KEYS.timerState, state); listeners.forEach(cb => cb(state)); }
  function on(cb) { listeners.push(cb); }

  let handle = null;
  function loop() {
    if (!state.running) return;
    if (state.mode === 'stopwatch') {
      state.elapsed += 1;
    } else {
      state.remaining = Math.max(0, state.remaining - 1);
      if (state.remaining === 0) state.running = false;
    }
    emit();
  }

  function start() { if (handle) return; state.running = true; handle = setInterval(loop, 1000); emit(); }
  function pause() { state.running = false; clearInterval(handle); handle = null; emit(); }
  function toggle() { state.running ? pause() : start(); }
  function reset() {
    state.remaining = state.mode === 'countdown' ? (state.lastSet || 180) : state.remaining;
    state.elapsed = 0;
    pause();
  }
  function setSeconds(sec) { state.remaining = sec; state.lastSet = sec; emit(); }
  function addSeconds(sec) {
    if (state.mode === 'stopwatch') state.elapsed = Math.max(0, state.elapsed + sec);
    else state.remaining = Math.max(0, state.remaining + sec);
    emit();
  }
  function setMode(mode) { state.mode = mode; pause(); emit(); }
  function setLabel(label) { state.segmentLabel = label; emit(); }
  function getState() { return state; }

  // resume ticking on load if it was running
  if (state.running) { handle = setInterval(loop, 1000); }

  return { on, start, pause, toggle, reset, setSeconds, addSeconds, setMode, setLabel, getState };
})();

function rsFmtClock(totalSec) {
  totalSec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
