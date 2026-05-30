export const PITCHES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function isValidBpm(value) {
  return Number.isInteger(value) && value >= 30 && value <= 240;
}

export function parseBpmInput(value) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const bpm = Number(trimmed);
  return isValidBpm(bpm) ? bpm : null;
}

export function getClickIntervalMs(bpm) {
  return 60000 / bpm;
}

export function shufflePitches(random = Math.random) {
  const shuffled = [...PITCHES];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function createIdleState(bpm = 60) {
  return {
    phase: 'idle',
    bpm,
    order: [],
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  };
}

export function startRound(bpm, createOrder = shufflePitches) {
  if (!isValidBpm(bpm)) {
    throw new Error('BPM must be an integer from 30 to 240');
  }

  return {
    phase: 'countin',
    bpm,
    order: createOrder(),
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  };
}

export function advanceAfterClick(state) {
  if (state.phase === 'countin') {
    if (state.countInBeat < 4) {
      return { ...state, countInBeat: state.countInBeat + 1 };
    }

    return { ...state, phase: 'running', countInBeat: 4, noteIndex: 0, beatInNote: 1 };
  }

  if (state.phase === 'running') {
    if (state.beatInNote < 6) {
      return { ...state, beatInNote: state.beatInNote + 1 };
    }

    if (state.noteIndex < state.order.length - 1) {
      return { ...state, noteIndex: state.noteIndex + 1, beatInNote: 1 };
    }

    return { ...state, phase: 'done', beatInNote: 6 };
  }

  return state;
}

export function getViewModel(state) {
  const base = {
    phase: state.phase,
    heading: 'FretFlash',
    prompt: '--',
    status: '',
    detail: '',
    beat: '',
    note: '',
    previewLabel: '',
    preview: '',
    primaryButton: '',
    showBpm: false,
    showStop: false,
  };

  if (state.phase === 'idle') {
    return {
      ...base,
      prompt: 'Ready',
      status: 'Play the displayed pitch on all 6 strings, frets 0–12, one string per click.',
      detail: 'String order: low E → A → D → G → B → high E.',
      primaryButton: 'Start',
      showBpm: true,
    };
  }

  if (state.phase === 'countin') {
    return {
      ...base,
      prompt: 'Get ready',
      status: `Count-in: ${state.countInBeat} / 4`,
      previewLabel: 'Starting note',
      preview: state.order[0],
      showStop: true,
    };
  }

  if (state.phase === 'running') {
    return {
      ...base,
      prompt: state.order[state.noteIndex],
      beat: `Beat ${state.beatInNote} / 6`,
      note: `Note ${state.noteIndex + 1} / 12`,
      previewLabel: 'Next',
      preview: state.order[state.noteIndex + 1] ?? 'Done',
      showStop: true,
    };
  }

  if (state.phase === 'done') {
    return {
      ...base,
      prompt: 'Done',
      primaryButton: 'Start again',
      showBpm: true,
    };
  }

  return base;
}

export function renderHtml(view, bpm, error = '') {
  const bpmControl = view.showBpm
    ? `<div class="control-row"><label for="bpm">BPM</label><input id="bpm" name="bpm" type="number" inputmode="numeric" min="30" max="240" step="1" value="${bpm}"></div>`
    : '';
  const primaryButton = view.primaryButton
    ? `<button id="start-button" type="button">${view.primaryButton}</button>`
    : '';
  const stopButton = view.showStop
    ? '<button id="stop-button" type="button">Stop</button>'
    : '';
  const errorHtml = error ? `<p class="error" role="alert">${error}</p>` : '';
  const previewAriaLabel = view.previewLabel === 'Next' ? 'Next note' : view.previewLabel;
  const previewHtml = view.preview
    ? `<div class="preview" aria-label="${previewAriaLabel}"><span>${view.previewLabel}</span><strong>${view.preview}</strong></div>`
    : '';

  return `<h1>${view.heading}</h1>
<div class="prompt" aria-live="polite">${view.prompt}</div>
${previewHtml}
${view.status ? `<p class="status">${view.status}</p>` : ''}
${view.detail ? `<p class="detail">${view.detail}</p>` : ''}
${view.beat ? `<p class="beat">${view.beat}</p>` : ''}
${view.note ? `<p class="note">${view.note}</p>` : ''}
${bpmControl}
${errorHtml}
<div class="actions">${primaryButton}${stopButton}</div>`;
}

export function createAppController({
  render,
  playClick,
  prepareAudio = () => {},
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  createOrder = shufflePitches,
} = {}) {
  let state = createIdleState();
  let timerId = null;

  function clearTimer() {
    if (timerId !== null) {
      clearIntervalFn(timerId);
      timerId = null;
    }
  }

  function renderCurrent(error = '') {
    render(state, error);
  }

  function tick() {
    playClick();
    state = advanceAfterClick(state);
    renderCurrent();

    if (state.phase === 'done') {
      clearTimer();
    }
  }

  return {
    getState() {
      return state;
    },

    start(bpmInput) {
      const bpm = parseBpmInput(bpmInput);
      if (bpm === null) {
        renderCurrent('Choose a BPM between 30 and 240.');
        return false;
      }

      clearTimer();

      try {
        prepareAudio();
      } catch {
        renderCurrent('Audio could not start. Try pressing Start again.');
        return false;
      }

      state = startRound(bpm, createOrder);
      renderCurrent();
      timerId = setIntervalFn(tick, getClickIntervalMs(bpm));
      return true;
    },

    stop() {
      clearTimer();
      state = createIdleState(state.bpm);
      renderCurrent();
    },
  };
}

export function createWebAudioClickPlayer(AudioContextCtor) {
  let audioContext = null;

  function prepare() {
    if (!AudioContextCtor) {
      throw new Error('Web Audio is not available');
    }

    if (audioContext === null) {
      audioContext = new AudioContextCtor();
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  function play() {
    if (audioContext === null) {
      return;
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }

  return { prepare, play };
}

export function mountBrowserApp({
  root,
  AudioContextCtor,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (!root) {
    throw new Error('FretFlash root element not found');
  }

  const clickPlayer = createWebAudioClickPlayer(AudioContextCtor);
  let controller;

  function render(state, error = '') {
    root.innerHTML = renderHtml(getViewModel(state), state.bpm, error);

    const startButton = root.querySelector('#start-button');
    if (startButton) {
      startButton.addEventListener('click', () => {
        const bpmInput = root.querySelector('#bpm');
        controller.start(bpmInput ? bpmInput.value : String(controller.getState().bpm));
      });
    }

    const stopButton = root.querySelector('#stop-button');
    if (stopButton) {
      stopButton.addEventListener('click', () => controller.stop());
    }
  }

  controller = createAppController({
    render,
    prepareAudio: clickPlayer.prepare,
    playClick: clickPlayer.play,
    setIntervalFn,
    clearIntervalFn,
  });

  render(controller.getState());
  return controller;
}

if (typeof document !== 'undefined') {
  const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  mountBrowserApp({ root: document.getElementById('app'), AudioContextCtor });
}
