import {
  isValidFretRange,
  parseBpmInput,
  parseFretBoundInput,
} from '../settings.js';

import { FRET_RANGE_ERROR } from '../render.js';

export function createSetupDrafts({ root, controller, render }) {
  function syncValidBpmFromInput(valueOverride, { render: shouldRender = true } = {}) {
    const bpmInput = root.querySelector('#bpm');
    if (!bpmInput && valueOverride === undefined) {
      return false;
    }

    const bpm = parseBpmInput(valueOverride ?? bpmInput.value);
    if (bpm === null) {
      return false;
    }

    controller.setBpm(bpm, { render: shouldRender });
    return true;
  }

  function getFretRangeInputDraft() {
    const stateRange = controller.getState().fretRange;
    const fromInput = root.querySelector('#fret-from');
    const toInput = root.querySelector('#fret-to');
    return {
      from: fromInput?.value ?? stateRange.from,
      to: toInput?.value ?? stateRange.to,
    };
  }

  function hasFretRangeInputs() {
    return Boolean(root.querySelector('#fret-from') && root.querySelector('#fret-to'));
  }

  function readFretRangeFromInputs() {
    const fromInput = root.querySelector('#fret-from');
    const toInput = root.querySelector('#fret-to');
    if (!fromInput || !toInput) {
      return { ok: true, range: controller.getState().fretRange };
    }

    const from = parseFretBoundInput(fromInput.value);
    const to = parseFretBoundInput(toInput.value);
    if (from === null || to === null || !isValidFretRange({ from, to })) {
      return { ok: false, range: null };
    }

    return { ok: true, range: { from, to } };
  }

  function renderFretRangeError(renderFretRange = getFretRangeInputDraft()) {
    render(controller.getState(), FRET_RANGE_ERROR, renderFretRange);
  }

  function validateFretRangeInputDraft({ renderInvalid = false } = {}) {
    if (!hasFretRangeInputs()) {
      return true;
    }

    const result = readFretRangeFromInputs();
    if (!result.ok) {
      if (renderInvalid) {
        renderFretRangeError();
      }
      return false;
    }

    return true;
  }

  function syncValidFretRangeFromInput({ renderInvalid = false, renderValid = true } = {}) {
    if (!validateFretRangeInputDraft({ renderInvalid })) {
      return false;
    }
    const result = readFretRangeFromInputs();
    if (result.ok && hasFretRangeInputs()) {
      controller.setFretRange(result.range, { render: renderValid });
    }
    return true;
  }

  function syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange = false, renderValid = true } = {}) {
    const bpmInput = root.querySelector('#bpm');
    const bpmDraft = bpmInput?.value;
    const fretRangeOk = syncValidFretRangeFromInput({ renderInvalid: renderInvalidFretRange, renderValid });
    syncValidBpmFromInput(bpmDraft, { render: renderValid });
    return fretRangeOk;
  }

  function applySetupEdit(update, persistCurrentSettings) {
    const invalidFretDraft = getFretRangeInputDraft();
    const showFretError = !syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange: true });
    update();
    persistCurrentSettings();
    if (showFretError) renderFretRangeError(invalidFretDraft);
  }

  return {
    applySetupEdit,
    getFretRangeInputDraft,
    readFretRangeFromInputs,
    renderFretRangeError,
    syncSetupInputsAndRequireValidFretRange,
    syncValidBpmFromInput,
    syncValidFretRangeFromInput,
    validateFretRangeInputDraft,
  };
}
