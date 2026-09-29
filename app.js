// Musical model and defaults
import {
  KNOWN_NOTE_LABELS,
  NOTE_PRESETS,
  TUNING_PRESET_BY_ID,
} from './src/music.js';

import {
  BPM_MAX,
  BPM_MIN,
  createSetup,
  isValidBpm,
  isValidFretRange,
  loadSettings,
  parseBpmInput,
  parseFretBoundInput,
  parseTuningInput,
  saveSettings,
} from './src/settings.js';

import {
  createIdleState,
} from './src/state.js';
import { shuffleSelectedLabels } from './src/round.js';
import { getViewModel } from './src/view-model.js';

import { renderHtml } from './src/render.js';

import { createWebAudioClickPlayer } from './src/audio.js';
import { createSetupDrafts } from './src/browser/setup-drafts.js';
import { createAppController } from './src/controller.js';

// Browser mounting and event wiring
function getBrowserStorage() {
  if (typeof document === 'undefined') {
    return undefined;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function mountBrowserApp({
  root,
  AudioContextCtor,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  storage = getBrowserStorage(),
  documentTarget = typeof document === 'undefined' ? undefined : document,
  documentElement = documentTarget?.documentElement,
  matchMediaFn = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia.bind(globalThis) : undefined,
  navigatorLike = typeof globalThis.navigator === 'undefined' ? undefined : globalThis.navigator,
  createOrder = shuffleSelectedLabels,
} = {}) {
  if (!root) {
    throw new Error('FretFlash root element not found');
  }

  const clickPlayer = createWebAudioClickPlayer(AudioContextCtor);
  const initialSettings = loadSettings(storage);
  let controller;
  let setupDrafts;
  let openPopover = '';

  function persistCurrentSettings() {
    saveSettings(storage, controller.getState());
  }

  function scrollActiveProgressCellIntoView() {
    root.querySelector('.note-progress-rail [aria-current="step"]')?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
    });
  }

  function startFromCurrentInput() {
    const bpmInput = root.querySelector('#bpm');
    const bpmDraft = bpmInput ? bpmInput.value : String(controller.getState().bpm);
    const fretResult = setupDrafts.readFretRangeFromInputs();
    if (!fretResult.ok) {
      setupDrafts.renderFretRangeError();
      return false;
    }
    if (root.querySelector('#fret-from') && root.querySelector('#fret-to')) {
      controller.setFretRange(fretResult.range);
    }
    const started = controller.start(bpmDraft);
    if (started && typeof started.then === 'function') {
      started.then((didStart) => {
        if (didStart) persistCurrentSettings();
      });
    } else if (started) {
      persistCurrentSettings();
    }
    return started;
  }

  function repeatSameOrderFromCurrentInput() {
    const bpmInput = root.querySelector('#bpm');
    const bpmDraft = bpmInput ? bpmInput.value : String(controller.getState().bpm);
    if (!setupDrafts.validateFretRangeInputDraft({ renderInvalid: true })) {
      return false;
    }
    const started = controller.repeatSameOrder(bpmDraft);
    if (started && typeof started.then === 'function') {
      started.then((didStart) => {
        if (didStart) persistCurrentSettings();
      });
    } else if (started) {
      persistCurrentSettings();
    }
    return started;
  }

  function shouldIgnoreGlobalShortcut(event) {
    const target = event.target;
    if (!target) {
      return false;
    }

    const tagName = target.tagName?.toLowerCase();
    return target.isContentEditable
      || tagName === 'input'
      || tagName === 'textarea'
      || tagName === 'select'
      || tagName === 'button';
  }

  function isTouchFirstEnvironment() {
    const coarseNoHover = Boolean(matchMediaFn?.('(hover: none) and (pointer: coarse)')?.matches);
    const uaMobile = navigatorLike?.userAgentData?.mobile === true;
    return coarseNoHover || uaMobile;
  }

  function markKeyboardSeen(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    documentElement?.classList?.add?.('keyboard-seen');
  }

  function handleGlobalKeydown(event) {
    markKeyboardSeen(event);

    if (event.key === 'Escape') {
      if (openPopover) {
        event.preventDefault();
        openPopover = '';
        render(controller.getState());
        return;
      }
      const phase = controller.getState().phase;
      if (phase === 'countin' || phase === 'running' || phase === 'paused' || phase === 'done') {
        event.preventDefault();
        controller.stop();
      }
      return;
    }

    if (shouldIgnoreGlobalShortcut(event)) {
      return;
    }

    const isSpace = event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space';
    if (isSpace) {
      const phase = controller.getState().phase;
      if (phase === 'idle' || phase === 'done') {
        event.preventDefault();
        startFromCurrentInput();
      } else if (phase === 'countin' || phase === 'running') {
        event.preventDefault();
        controller.pause();
      } else if (phase === 'paused') {
        event.preventDefault();
        controller.resume();
      }
      return;
    }
  }

  function handleDocumentClick(event) {
    if (!openPopover) {
      return;
    }
    const target = event.target;
    if (target?.closest?.('[data-popover-target], .header-popover')) {
      return;
    }
    openPopover = '';
    render(controller.getState());
  }

  function handleRootClick(event) {
    const target = event.target;
    const button = target?.closest?.('button');
    if (!button || !root.contains(button)) {
      return;
    }

    if (button.dataset.popoverTarget) {
      openPopover = openPopover === button.dataset.popoverTarget ? '' : button.dataset.popoverTarget;
      render(controller.getState());
      return;
    }

    if (button.dataset.bpm) {
      const bpm = parseBpmInput(button.dataset.bpm);
      if (bpm !== null) {
        controller.setBpm(bpm);
        persistCurrentSettings();
      }
      return;
    }

    if (button.dataset.bpmStep) {
      const currentBpm = controller.getState().bpm;
      const step = Number(button.dataset.bpmStep);
      const nextBpm = currentBpm + step;
      if (isValidBpm(nextBpm)) {
        controller.setBpm(nextBpm);
        persistCurrentSettings();
      }
      return;
    }

    if (button.dataset.fretPreset) {
      const nextRange = {
        from: parseFretBoundInput(button.dataset.fretFrom),
        to: parseFretBoundInput(button.dataset.fretTo),
      };
      if (isValidFretRange(nextRange)) {
        controller.setFretRange(nextRange);
        persistCurrentSettings();
      }
      return;
    }

    if (button.id === 'start-button') {
      startFromCurrentInput();
      return;
    }

    if (button.id === 'brand-home-button' || button.id === 'setup-button') {
      controller.stop();
      return;
    }

    if (button.id === 'same-order-button') {
      repeatSameOrderFromCurrentInput();
      return;
    }

    if (button.id === 'pause-button') {
      controller.pause();
      return;
    }

    if (button.id === 'resume-button') {
      controller.resume();
      return;
    }

    if (button.id === 'restart-button') {
      controller.restartCurrent();
      return;
    }

    if (button.id === 'stop-button') {
      controller.stop();
      return;
    }

    if (button.dataset.noteLabel) {
      const label = button.dataset.noteLabel;
      const selected = new Set(controller.getState().selectedLabels);
      if (selected.has(label)) {
        selected.delete(label);
      } else {
        selected.add(label);
      }
      setupDrafts.applySetupEdit(() => {
        controller.setSelectedLabels(KNOWN_NOTE_LABELS.filter((knownLabel) => selected.has(knownLabel)));
      }, persistCurrentSettings);
      return;
    }

    if (button.dataset.preset) {
      setupDrafts.applySetupEdit(() => {
        controller.setSelectedLabels(NOTE_PRESETS[button.dataset.preset] ?? controller.getState().selectedLabels);
      }, persistCurrentSettings);
      return;
    }

    if (button.dataset.locationMode) {
      setupDrafts.applySetupEdit(() => {
        controller.setLocationMode(button.dataset.locationMode);
      }, persistCurrentSettings);
      return;
    }

    if (button.dataset.tuningId) {
      const preset = TUNING_PRESET_BY_ID.get(button.dataset.tuningId);
      if (preset) {
        setupDrafts.applySetupEdit(() => {
          controller.setTuning({ id: preset.id, strings: preset.strings });
        }, persistCurrentSettings);
      }
      return;
    }

    if (button.dataset.stringIndex) {
      const index = Number(button.dataset.stringIndex);
      const selected = new Set(controller.getState().selectedStringIndexes);
      if (selected.has(index) && selected.size > 1) {
        selected.delete(index);
      } else {
        selected.add(index);
      }
      setupDrafts.applySetupEdit(() => {
        controller.setSelectedStringIndexes([...selected]);
      }, persistCurrentSettings);
    }
  }

  function render(state, error = '', renderFretRange = state.fretRange) {
    root.innerHTML = renderHtml(
      getViewModel(state),
      { ...createSetup(state), renderFretRange, openPopover },
      error,
    );

    scrollActiveProgressCellIntoView();

    const bpmInput = root.querySelector('#bpm');
    if (bpmInput) {
      bpmInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const bpmDraft = bpmInput.value;
          const invalidFretDraft = setupDrafts.getFretRangeInputDraft();
          const showFretError = !setupDrafts.syncValidFretRangeFromInput({ renderInvalid: true });
          if (setupDrafts.syncValidBpmFromInput(bpmDraft)) {
            persistCurrentSettings();
            if (showFretError) setupDrafts.renderFretRangeError(invalidFretDraft);
          }
          bpmInput.blur();
        }
      });
      bpmInput.addEventListener('wheel', (event) => {
        const currentBpm = parseBpmInput(bpmInput.value) ?? controller.getState().bpm;
        const direction = event.deltaY < 0 ? 1 : -1;
        const nextBpm = Math.min(BPM_MAX, Math.max(BPM_MIN, currentBpm + direction));
        event.preventDefault();
        if (nextBpm !== currentBpm) {
          bpmInput.value = String(nextBpm);
          controller.setBpm(nextBpm);
          persistCurrentSettings();
        }
      });
      bpmInput.addEventListener('blur', () => {
        const bpmDraft = bpmInput.value;
        const invalidFretDraft = setupDrafts.getFretRangeInputDraft();
        const showFretError = !setupDrafts.syncValidFretRangeFromInput({ renderInvalid: true, renderValid: false });
        if (setupDrafts.syncValidBpmFromInput(bpmDraft, { render: false })) {
          persistCurrentSettings();
          if (showFretError) setupDrafts.renderFretRangeError(invalidFretDraft);
        }
      });
    }

    ['#fret-from', '#fret-to'].forEach((selector) => {
      const input = root.querySelector(selector);
      if (!input) {
        return;
      }

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (setupDrafts.syncValidFretRangeFromInput({ renderInvalid: true })) {
            persistCurrentSettings();
          }
          input.blur();
        }
      });
      input.addEventListener('blur', () => {
        if (setupDrafts.syncValidFretRangeFromInput({ renderInvalid: true, renderValid: false })) {
          persistCurrentSettings();
        }
      });
    });

    const customTuningInput = root.querySelector('#custom-tuning');
    if (customTuningInput) {
      const applyCustomTuning = ({ renderValid = true } = {}) => {
        const tuning = parseTuningInput(customTuningInput.value);
        if (!tuning) {
          render(controller.getState(), 'Use 6 or 7 tuning notes like E A D G B e.', setupDrafts.getFretRangeInputDraft());
          return false;
        }
        const invalidFretDraft = setupDrafts.getFretRangeInputDraft();
        const showFretError = !setupDrafts.syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange: true, renderValid });
        controller.setTuning(tuning, { render: renderValid });
        persistCurrentSettings();
        if (showFretError) setupDrafts.renderFretRangeError(invalidFretDraft);
        return true;
      };
      customTuningInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyCustomTuning();
          customTuningInput.blur();
        }
      });
      customTuningInput.addEventListener('blur', () => applyCustomTuning({ renderValid: false }));
    }

  }

  controller = createAppController({
    render,
    prepareAudio: clickPlayer.prepare,
    playClick: clickPlayer.play,
    setIntervalFn,
    clearIntervalFn,
    createOrder,
    initialState: createIdleState(initialSettings),
  });

  setupDrafts = createSetupDrafts({ root, controller, render });

  render(controller.getState());
  documentElement?.classList?.toggle?.('touch-first', isTouchFirstEnvironment());
  documentElement?.classList?.remove?.('keyboard-seen');
  root.addEventListener('click', handleRootClick);
  if (documentTarget) {
    documentTarget.addEventListener('keydown', handleGlobalKeydown);
    documentTarget.addEventListener('click', handleDocumentClick);
  }
  return controller;
}

if (typeof document !== 'undefined') {
  const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  mountBrowserApp({ root: document.getElementById('app'), AudioContextCtor });
}
