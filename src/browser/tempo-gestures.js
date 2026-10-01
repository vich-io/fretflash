// Pointer state is transient; all value changes use the existing BPM command.
// Ordinary clicks retain quick taps and keyboard/assistive activation.
export function bindTempoGestures(root, stepBpm) {
  const doc = root.ownerDocument, win = doc.defaultView;
  let active = null, timer, suppressedClick = null;

  function finish(cancelled = true) {
    if (!active) return;
    const gesture = active;
    active = null;
    win.clearTimeout(timer);
    if (cancelled || gesture.kind === 'drag' || gesture.repeated) suppressedClick = gesture.element;
    if (gesture.element.hasPointerCapture(gesture.id)) gesture.element.releasePointerCapture(gesture.id);
    // Focus synchronously only for a deliberate non-drag tap (mobile keypad).
    if (!cancelled && gesture.kind === 'drag' && !gesture.dragging) gesture.element.focus({ preventScroll: true });
  }

  function reconcile() {
    if (active && (!root.contains(active.element) || active.element.disabled ||
        !active.element.closest('[data-popover="bpm"][data-open="true"]'))) finish();
  }

  function repeat() {
    reconcile();
    if (!active || active.kind !== 'hold') return;
    active.repeated = true;
    stepBpm(active.delta);
    if (!active) return;
    const held = win.performance.now() - active.started;
    timer = win.setTimeout(repeat, held >= 3000 ? 25 : held >= 1500 ? 50 : 120);
  }

  doc.addEventListener('pointerdown', event => {
    if (active) finish(); // An additional pointer ends the current gesture too.
    if (!event.isPrimary || event.button !== 0) return;
    suppressedClick = null;
    const element = event.target.closest?.('#bpm, [data-bpm-step]');
    if (!element || !root.contains(element) || element.disabled ||
        !element.closest('[data-popover="bpm"][data-open="true"]')) return;
    const isInput = element.id === 'bpm';
    // Preserve mouse text selection and already-focused touch input editing.
    if (isInput && (event.pointerType === 'mouse' || doc.activeElement === element)) return;
    if (isInput) event.preventDefault();
    active = {
      element, id: event.pointerId, kind: isInput ? 'drag' : 'hold',
      startX: event.clientX, startY: event.clientY, lastY: event.clientY,
      dragging: false, repeated: false, delta: Number(element.dataset.bpmStep),
      started: win.performance.now(),
    };
    element.setPointerCapture(event.pointerId);
    if (!isInput) timer = win.setTimeout(repeat, 450);
  });

  win.addEventListener('pointermove', event => {
    reconcile();
    if (!active || active.id !== event.pointerId) return;
    if (active.kind === 'hold') {
      const box = active.element.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right ||
          event.clientY < box.top || event.clientY > box.bottom) finish();
      return;
    }
    if (!active.dragging) {
      const dx = event.clientX - active.startX, dy = event.clientY - active.startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dx) > Math.abs(dy)) { finish(); return; }
      active.dragging = true;
      active.lastY = active.startY + Math.sign(dy) * 6;
    }
    event.preventDefault();
    const steps = Math.trunc((active.lastY - event.clientY) / 4);
    if (steps) {
      // Consume movement at the limits so direction reversal has no dead zone.
      active.lastY -= steps * 4;
      stepBpm(steps);
    }
  }, { passive: false });

  win.addEventListener('pointerup', event => { if (active?.id === event.pointerId) finish(false); });
  for (const name of ['pointercancel', 'lostpointercapture']) {
    win.addEventListener(name, event => { if (active?.id === event.pointerId) finish(); });
  }
  for (const name of ['blur', 'pagehide']) win.addEventListener(name, () => finish());
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) finish(); });

  root.addEventListener('click', event => {
    const element = event.target.closest?.('#bpm, [data-bpm-step]');
    if (!suppressedClick || event.detail === 0 || element !== suppressedClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressedClick = null;
  }, true);
  root.addEventListener('contextmenu', event => {
    if (event.target.closest?.('[data-bpm-step]') ||
        (event.target.id === 'bpm' && doc.activeElement !== event.target)) event.preventDefault();
  });
  return { reconcile };
}
