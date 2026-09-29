import { KNOWN_NOTE_LABELS, NOTE_PRESETS, TUNING_PRESET_BY_ID } from './src/music.js';
import { BPM_MIN, BPM_MAX, createSetup, loadSettings, parseBpmInput, saveSettings } from './src/settings.js';
import { createIdleState } from './src/state.js';
import { shuffleSelectedLabels } from './src/round.js';
import { getViewModel } from './src/view-model.js';
import { renderHtml } from './src/render.js';
import { createWebAudioClickPlayer } from './src/audio.js';
import { createSetupDrafts } from './src/browser/setup-drafts.js';
import { createAppController } from './src/controller.js';

function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

// Reconcile the app's fixed markup without replacing unchanged controls or focus.
// Handlers are delegated, so retained nodes never accumulate listeners.
function updateChildren(parent, next) {
  const children = [...next.childNodes];
  children.forEach((replacement, index) => {
    const current = parent.childNodes[index];
    if (!current) { parent.append(replacement.cloneNode(true)); return; }
    if (current.nodeName !== replacement.nodeName || current.id !== replacement.id) {
      current.replaceWith(replacement.cloneNode(true)); return;
    }
    if (current.nodeType === 3) {
      if (current.data !== replacement.data) current.data = replacement.data;
      return;
    }
    if (current.nodeType !== 1) return;
    for (const attribute of [...current.attributes]) {
      if (!replacement.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
    }
    for (const attribute of replacement.attributes) {
      if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
    }
    if (current.tagName === 'INPUT' && current.value !== replacement.value) current.value = replacement.value;
    updateChildren(current, replacement);
  });
  while (parent.childNodes.length > children.length) parent.lastChild.remove();
}

export function mountBrowserApp({
  root, AudioContextCtor, storage = browserStorage(),
  documentTarget = globalThis.document, documentElement = documentTarget?.documentElement,
  matchMediaFn = globalThis.matchMedia?.bind(globalThis), navigatorLike = globalThis.navigator,
  createOrder = shuffleSelectedLabels,
} = {}) {
  if (!root) throw new Error('FretFlash root element not found');
  const initialSettings = loadSettings(storage);
  const drafts = createSetupDrafts(initialSettings);
  const player = createWebAudioClickPlayer(AudioContextCtor);
  let controller;
  let openPopover = '';
  let actionError = '';
  let painting = false;
  let previousPhase = 'idle';
  const inputFields = { bpm: 'bpm', 'fret-from': 'from', 'fret-to': 'to', 'custom-tuning': 'tuning' };

  function paint(state = controller.getState()) {
    painting = true;
    const html = renderHtml(getViewModel(state), {
      ...createSetup(state), openPopover, drafts: drafts.values, fieldErrors: drafts.errors,
      renderFretRange: { from: drafts.values.from, to: drafts.values.to },
      invalidDraft: Boolean(drafts.errors.fretRange), startPending: Boolean(state.startPending),
    }, actionError || (state.phase === 'idle' ? drafts.errors.bpm || drafts.errors.tuning : ''));
    const template = documentTarget.createElement('template');
    template.innerHTML = html;
    if (state.startPending) {
      for (const button of template.content.querySelectorAll('#start-button, #same-order-button, #restart-button, #resume-button')) button.disabled = true;
    }
    updateChildren(root, template.content);
    if (previousPhase === 'idle' && state.phase !== 'idle') documentTarget.defaultView?.scrollTo(0, 0);
    previousPhase = state.phase;
    const rail = root.querySelector('.note-progress-rail');
    const current = rail?.querySelector('[aria-current="step"]');
    if (current) {
      const cell = current.getBoundingClientRect(), box = rail.getBoundingClientRect();
      if (cell.left < box.left || cell.right > box.right) rail.scrollLeft += cell.left - box.left - (box.width - cell.width) / 2;
    }
    painting = false;
  }

  function render(state, error = '') { actionError = error; paint(state); }
  function persist() { saveSettings(storage, controller.getState()); }

  function commit(transform = setup => setup, resetFields = []) {
    const { setup } = drafts.read(controller.getState());
    const next = transform(setup);
    drafts.reset(next, resetFields);
    const result = drafts.read(next);
    actionError = '';
    controller.setSetup(result.setup);
    persist();
    return result.valid;
  }

  function stop() {
    drafts.reset(createSetup(controller.getState()));
    openPopover = '';
    controller.stop();
  }

  function start(repeat = false) {
    const state = controller.getState();
    if (state.startPending) return;
    if (state.phase === 'idle' && !commit()) {
      actionError = Object.values(drafts.errors).find(Boolean) || '';
      paint();
      return;
    }
    openPopover = '';
    const started = repeat ? controller.repeatSameOrder(String(controller.getState().bpm)) : controller.start(String(controller.getState().bpm));
    Promise.resolve(started).then(didStart => { if (didStart) persist(); });
  }

  function editBpm(value) {
    const bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, value));
    commit(setup => ({ ...setup, bpm }), ['bpm']);
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || button.disabled) return;
    if (button.dataset.popoverTarget) {
      openPopover = openPopover === button.dataset.popoverTarget ? '' : button.dataset.popoverTarget;
      paint(); return;
    }
    // An app action owns this click, including closing an outside editor.
    if (!button.closest('.header-popover')) openPopover = '';
    const transport = {
      'start-button': () => start(), 'same-order-button': () => start(true),
      'pause-button': () => controller.pause(), 'resume-button': () => controller.resume(),
      'restart-button': () => controller.restartCurrent(), 'stop-button': stop,
      'brand-home-button': stop, 'setup-button': stop, 'cancel-start-button': stop,
    };
    if (transport[button.id]) { transport[button.id](); return; }
    const data = button.dataset;
    if (data.bpm) { editBpm(Number(data.bpm)); return; }
    if (data.bpmStep) { editBpm((parseBpmInput(drafts.values.bpm) ?? controller.getState().bpm) + Number(data.bpmStep)); return; }
    if (data.fretPreset) {
      commit(setup => ({ ...setup, fretRange: { from: Number(data.fretFrom), to: Number(data.fretTo) } }), ['fretRange']); return;
    }
    if (data.tuningId) {
      const preset = TUNING_PRESET_BY_ID.get(data.tuningId);
      if (preset) commit(setup => ({ ...setup, tuning: preset, selectedStringIndexes: preset.strings.join(' ') === setup.tuning.strings.join(' ') ? setup.selectedStringIndexes : preset.strings.map((_, i) => i) }), ['tuning']);
      return;
    }
    if (data.locationMode) { commit(setup => ({ ...setup, locationMode: data.locationMode })); return; }
    if (data.preset) { commit(setup => ({ ...setup, selectedLabels: data.preset === 'clear' ? [] : NOTE_PRESETS[data.preset] })); return; }
    if (data.noteLabel) {
      commit(setup => {
        const selected = new Set(setup.selectedLabels);
        if (selected.has(data.noteLabel)) selected.delete(data.noteLabel); else selected.add(data.noteLabel);
        return { ...setup, selectedLabels: KNOWN_NOTE_LABELS.filter(label => selected.has(label)) };
      }); return;
    }
    if (data.stringIndex !== undefined) {
      commit(setup => {
        const selected = new Set(setup.selectedStringIndexes), index = Number(data.stringIndex);
        if (selected.has(index)) { if (selected.size > 1) selected.delete(index); } else selected.add(index);
        return { ...setup, selectedStringIndexes: [...selected] };
      });
    }
  }

  function handleKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
    documentElement.classList.add('keyboard-seen');
    const state = controller.getState();
    if (event.key === 'Escape') {
      if (event.repeat) { event.preventDefault(); return; }
      if (state.startPending || state.phase !== 'idle') { event.preventDefault(); stop(); return; }
      if (openPopover) {
        event.preventDefault(); const trigger = openPopover; openPopover = ''; paint();
        root.querySelector(`[data-popover-target="${trigger}"]`)?.focus({ preventScroll: true });
      }
      return;
    }
    const target = event.target;
    if (event.key === 'Enter' && inputFields[target.id]) {
      event.preventDefault();
      if (!event.repeat) { drafts.edit(inputFields[target.id], target.value); commit(); target.blur(); }
      return;
    }
    const space = event.key === ' ' || event.code === 'Space';
    if (event.repeat && (space || event.key === 'Enter') && target.closest?.('.practice-actions, .done-actions, .deck-footer')) {
      event.preventDefault(); return;
    }
    if (target.isContentEditable || target.closest?.('input, textarea, select, button, a')) return;
    if (!space) return;
    event.preventDefault();
    if (event.repeat || state.startPending) return;
    if (state.phase === 'idle' || state.phase === 'done') start();
    else if (state.phase === 'paused') controller.resume();
    else controller.pause();
  }

  controller = createAppController({ render, prepareAudio: player.prepare, playClick: player.play,
    createOrder, initialState: createIdleState(initialSettings),
    audioClock: player.now, cancelClick: player.cancel,
  });
  paint();
  documentElement.classList.toggle('touch-first', Boolean(matchMediaFn?.('(hover: none) and (pointer: coarse)')?.matches || navigatorLike?.userAgentData?.mobile));
  documentElement.classList.remove('keyboard-seen');
  root.addEventListener('click', handleClick);
  root.addEventListener('input', event => {
    const field = inputFields[event.target.id];
    if (!field) return;
    drafts.edit(field, event.target.value);
    // Changing a draft revokes a pending Start even before the field is committed.
    if (controller.getState().startPending) controller.stop();
    drafts.read(controller.getState());
    paint();
  });
  root.addEventListener('focusout', event => {
    if (painting || !inputFields[event.target.id]) return;
    drafts.edit(inputFields[event.target.id], event.target.value);
    commit();
  });
  root.addEventListener('wheel', event => {
    if (event.target.id !== 'bpm' || event.deltaY === 0) return;
    event.preventDefault();
    editBpm((parseBpmInput(drafts.values.bpm) ?? controller.getState().bpm) + (event.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  documentTarget.addEventListener('keydown', handleKey);
  documentTarget.addEventListener('click', event => {
    if (root.contains(event.target) && event.target.closest('button, .header-popover')) return;
    if (openPopover) { openPopover = ''; paint(); }
  });
  documentTarget.addEventListener('visibilitychange', () => {
    if (documentTarget.hidden) {
      if (controller.getState().startPending) stop(); else controller.pause();
    }
  });
  return controller;
}

if (typeof document !== 'undefined') {
  mountBrowserApp({ root: document.getElementById('app'), AudioContextCtor: globalThis.AudioContext ?? globalThis.webkitAudioContext });
}
