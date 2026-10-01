import { KNOWN_NOTE_LABELS, NOTE_PRESETS, TUNING_PRESET_BY_ID } from './src/music.js?v=3ec35fda7bf8f641';
import { FRET_MIN, FRET_MAX, isValidFretRange, parseFretBoundInput,
 BPM_MIN, createSetup, loadSettings, parseBpmInput, saveSettings } from './src/settings.js?v=3ec35fda7bf8f641';
import { createIdleState } from './src/state.js?v=3ec35fda7bf8f641';
import { shuffleSelectedLabels } from './src/round.js?v=3ec35fda7bf8f641';
import { getViewModel } from './src/view-model.js?v=3ec35fda7bf8f641';
import { renderHtml } from './src/render.js?v=3ec35fda7bf8f641';
import { createWebAudioClickPlayer } from './src/audio.js?v=3ec35fda7bf8f641';
import { createSetupDrafts } from './src/browser/setup-drafts.js?v=3ec35fda7bf8f641';
import { bindNumericGestures } from './src/browser/numeric-gestures.js?v=3ec35fda7bf8f641';
import { createAppController } from './src/controller.js?v=3ec35fda7bf8f641';
import { setupPwa } from './src/browser/pwa.js?v=3ec35fda7bf8f641';

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
    // The PWA manager owns this stable node and its listeners across ordinary paints.
    if (current.hasAttribute('data-maintenance-slot') && replacement.hasAttribute('data-maintenance-slot')) return;
    for (const attribute of [...current.attributes]) {
      if (current.tagName === 'DETAILS' && attribute.name === 'open') continue;
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
  onPaint = () => {},
} = {}) {
  if (!root) throw new Error('FretFlash root element not found');
  // Keep the prerendered help copy, but let live disclosure state belong to its DOM nodes.
  const quickReference = root.querySelector('#quick-reference').cloneNode(true);
  quickReference.removeAttribute('open');
  for (const detail of quickReference.querySelectorAll('details')) detail.removeAttribute('open');
  const initialSettings = loadSettings(storage);
  const drafts = createSetupDrafts(initialSettings);
  const player = createWebAudioClickPlayer(AudioContextCtor);
  let controller;
  let openPopover = '';
  let actionError = '';
  let painting = false;
  let previousPhase = 'idle';
  let numericGestures;
  let pendingAction = '', pendingFeedback = false, pendingTimer;
  const inputFields = { bpm: 'bpm', 'fret-from': 'from', 'fret-to': 'to', 'custom-tuning': 'tuning' };

  function paint(state = controller.getState()) {
    painting = true;
    const html = renderHtml(getViewModel(state), {
      ...createSetup(state), bpmMax: controller.getBpmMax(), openPopover, drafts: drafts.values, fieldErrors: drafts.errors,
      renderFretRange: { from: drafts.values.from, to: drafts.values.to },
      invalidDraft: Boolean(drafts.errors.fretRange), startPending: Boolean(state.startPending), spokenPending: Boolean(state.spokenPending),
    }, actionError || drafts.errors.bpm || drafts.errors.tuning || '');
    const template = documentTarget.createElement('template');
    template.innerHTML = html;
    template.content.querySelector('#quick-reference-slot')?.replaceWith(quickReference.cloneNode(true));
    if (state.startPending) {
      if (!pendingTimer && !pendingFeedback) pendingTimer = setTimeout(() => {
        pendingTimer = undefined; pendingFeedback = true; paint();
      }, 300);
      for (const button of template.content.querySelectorAll('#start-button, #same-order-button, #restart-button, #resume-button')) {
        button.disabled = button.id !== pendingAction;
        if (button.disabled) continue;
        button.dataset.cancelStart = '';
        button.setAttribute('aria-busy', 'true');
        if (pendingFeedback) button.textContent = 'Cancel';
        button.setAttribute('aria-label', `${button.textContent} (preparing; press to cancel)`);
      }
    } else {
      clearTimeout(pendingTimer); pendingTimer = undefined; pendingFeedback = false;
    }
    updateChildren(root, template.content);
    numericGestures?.reconcile();
    if (previousPhase === 'idle' && state.phase !== 'idle') documentTarget.defaultView?.scrollTo(0, 0);
    previousPhase = state.phase;
    const rail = root.querySelector('.note-progress-rail');
    const current = rail?.querySelector('[aria-current="step"]');
    if (current) {
      const cell = current.getBoundingClientRect(), box = rail.getBoundingClientRect();
      if (cell.left < box.left || cell.right > box.right) rail.scrollLeft += cell.left - box.left - (box.width - cell.width) / 2;
    }
    painting = false;
    onPaint(state);
  }

  function render(state, error = '') { actionError = error; paint(state); }
  function persist() { saveSettings(storage, controller.getState()); }

  function commit(transform = setup => setup, resetFields = []) {
    const state = controller.getState();
    const maximum = state.phase === 'paused' ? controller.getBpmMax() : undefined;
    const { setup } = drafts.read(state, maximum);
    const next = transform(setup);
    drafts.reset(next, resetFields);
    const result = drafts.read(next, maximum);
    actionError = '';
    if (controller.getState().phase === 'idle') controller.setSetup(result.setup);
    else controller.setBpm(result.setup.bpm);
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
    if (!commit()) {
      actionError = Object.values(drafts.errors).find(Boolean) || '';
      paint();
      return;
    }
    openPopover = '';
    pendingAction = repeat ? 'same-order-button' : 'start-button';
    const started = repeat ? controller.repeatSameOrder(String(controller.getState().bpm)) : controller.start(String(controller.getState().bpm));
    Promise.resolve(started).then(didStart => { if (didStart) persist(); });
  }

  function editBpm(value) {
    const bpm = Math.max(BPM_MIN, Math.min(controller.getBpmMax(), value));
    commit(setup => ({ ...setup, bpm }), ['bpm']);
  }

  function stepBpm(delta) {
    editBpm((parseBpmInput(drafts.values.bpm) ?? controller.getState().bpm) + delta);
  }

  function stepFret(bound, delta) {
    const parsed = { from: parseFretBoundInput(drafts.values.from), to: parseFretBoundInput(drafts.values.to) };
    const range = isValidFretRange(parsed) ? parsed : controller.getState().fretRange;
    const lower = bound === 'from' ? FRET_MIN : range.from;
    const upper = bound === 'from' ? range.to : FRET_MAX;
    const fretRange = { ...range, [bound]: Math.max(lower, Math.min(upper, range[bound] + delta)) };
    commit(setup => ({ ...setup, fretRange }), ['fretRange']);
  }

  function closeEditor() {
    const trigger = openPopover;
    openPopover = '';
    paint();
    const button = root.querySelector(`[data-popover-target="${trigger}"]`);
    button?.focus({ preventScroll: true });
    if (matchMediaFn?.('(max-width: 720px)').matches) {
      if (controller.getState().phase === 'idle') button?.scrollIntoView({ block: 'nearest' });
      else documentTarget.defaultView?.scrollTo(0, 0);
    }
  }

  function continueRound(restart = false) {
    if (controller.getState().startPending || !commit()) return;
    openPopover = '';
    pendingAction = restart ? 'restart-button' : 'resume-button';
    if (restart) controller.restartCurrent(); else controller.resume();
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || button.disabled) return;
    if (button.hasAttribute('data-cancel-start')) { stop(); return; }
    if (button.closest('.pwa-notice')) return;
    if (button.dataset.popoverTarget || button.dataset.recoverEditor) {
      const target = button.dataset.popoverTarget || button.dataset.recoverEditor;
      if (openPopover === target) { closeEditor(); return; }
      openPopover = target;
      paint();
      const panel = root.querySelector(`[data-popover="${openPopover}"]`);
      if (matchMediaFn?.('(max-width: 720px)').matches && panel.getBoundingClientRect().bottom > documentTarget.defaultView.innerHeight) {
        panel.scrollIntoView({ block: 'start' });
      }
      if (openPopover && (event.detail === 0 || button.dataset.recoverEditor)) {
        (panel.querySelector('input') || panel.querySelector('button:not([data-close-editor])'))?.focus();
      }
      return;
    }
    if (button.hasAttribute('data-close-editor')) { closeEditor(); return; }
    // An app action owns this click, including closing an outside editor.
    if (!button.closest('.header-popover')) openPopover = '';
    const transport = {
      'start-button': () => start(), 'same-order-button': () => start(true),
      'pause-button': () => controller.pause(), 'resume-button': () => continueRound(),
      'restart-button': () => continueRound(true), 'stop-button': stop,
      'brand-home-button': stop, 'setup-button': stop,
    };
    if (transport[button.id]) { transport[button.id](); return; }
    const data = button.dataset;
    if (data.bpm) { editBpm(Number(data.bpm)); return; }
    if (data.bpmStep) { stepBpm(Number(data.bpmStep)); return; }
    if (data.fretStep) { stepFret(data.fretBound, Number(data.fretStep)); return; }
    if (data.fretPreset) {
      commit(setup => ({ ...setup, fretRange: { from: Number(data.fretFrom), to: Number(data.fretTo) } }), ['fretRange']); return;
    }
    if (data.tuningId) {
      const preset = TUNING_PRESET_BY_ID.get(data.tuningId);
      if (preset) commit(setup => ({ ...setup, tuning: preset, selectedStringIndexes: preset.strings.join(' ') === setup.tuning.strings.join(' ') ? setup.selectedStringIndexes : preset.strings.map((_, i) => i) }), ['tuning']);
      return;
    }
    if (data.locationMode) { commit(setup => ({ ...setup, locationMode: data.locationMode })); return; }
    if (button.id === 'spoken-cues-button') {
      if (controller.getState().phase === 'idle') commit(setup => ({ ...setup, spokenCues: !setup.spokenCues }));
      else {
        const changed = controller.setSpokenCues(!controller.getState().spokenCues);
        persist();
        Promise.resolve(changed).then(persist);
      }
      return;
    }
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
      if (openPopover) {
        event.preventDefault(); closeEditor(); return;
      }
      if (state.startPending || state.phase !== 'idle') { event.preventDefault(); stop(); }
      return;
    }
    const target = event.target;
    if (event.key === 'Enter' && inputFields[target.id]) {
      event.preventDefault();
      if (!event.repeat) { drafts.edit(inputFields[target.id], target.value); if (commit()) closeEditor(); }
      return;
    }
    const space = event.key === ' ' || event.code === 'Space';
    if (event.repeat && (space || event.key === 'Enter') && target.closest?.('.practice-actions, .done-actions, .deck-footer')) {
      event.preventDefault(); return;
    }
    if (target.isContentEditable || target.closest?.('input, textarea, select, button, a, summary')) return;
    if (!space) return;
    event.preventDefault();
    if (event.repeat || state.startPending) return;
    if (state.phase === 'idle' || state.phase === 'done') start();
    else if (state.phase === 'paused') continueRound();
    else controller.pause();
  }

  controller = createAppController({ render, prepareAudio: player.prepare, playClick: player.play,
    playSpeech: player.speak, stopSpeech: player.stopSpeech,
    createOrder, initialState: createIdleState(initialSettings),
    audioClock: player.now, cancelClick: player.cancel,
  });
  documentElement.classList.toggle('touch-first', Boolean(matchMediaFn?.('(hover: none) and (pointer: coarse)')?.matches || navigatorLike?.userAgentData?.mobile));
  documentElement.classList.remove('keyboard-seen');
  root.addEventListener('click', handleClick);
  numericGestures = bindNumericGestures(root, (element, delta) => {
    if (element.dataset.fretBound) stepFret(element.dataset.fretBound, delta);
    else stepBpm(delta);
  });
  root.addEventListener('input', event => {
    const field = inputFields[event.target.id];
    if (!field) return;
    drafts.edit(field, event.target.value);
    // Changing a draft revokes a pending Start even before the field is committed.
    if (controller.getState().startPending) {
      if (controller.getState().phase === 'idle') controller.stop();
      else controller.setBpm(controller.getState().bpm);
    }
    drafts.read(controller.getState(), controller.getState().phase === 'paused' ? controller.getBpmMax() : undefined);
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
    stepBpm(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  documentTarget.addEventListener('keydown', handleKey);
  documentTarget.addEventListener('click', event => {
    if (event.composedPath().includes(root) && event.target.closest('button, .header-popover')) return;
    if (openPopover) { openPopover = ''; paint(); }
  });
  const pauseHidden = () => {
    if (controller.getState().startPending) stop(); else if (!controller.pause()) player.stopSpeech();
  };
  documentTarget.addEventListener('visibilitychange', () => {
    if (documentTarget.hidden) pauseHidden();
  });
  documentTarget.defaultView?.addEventListener('pagehide', pauseHidden);
  // Restore setup and enable controls only after all event handlers are installed.
  paint();
  return controller;
}

if (typeof document !== 'undefined') {
  let pwa;
  const controller = mountBrowserApp({ root: document.getElementById('app'),
    AudioContextCtor: globalThis.AudioContext ?? globalThis.webkitAudioContext,
    onPaint: () => pwa?.refresh(),
  });
  pwa = setupPwa(document.querySelector('.pwa-notice'), () => {
    const state = controller.getState();
    return Boolean(state.startPending || ['countin', 'running', 'paused'].includes(state.phase));
  });
}
