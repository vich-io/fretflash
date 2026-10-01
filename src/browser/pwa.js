export function setupPwa(notice, isBusy) {
  if (!notice || !('serviceWorker' in navigator)) return { refresh() {} };
  const message = notice.querySelector('span'), button = notice.querySelector('button');
  let registration, failed = false, needsReload = false, requested = false, delayed = false;
  let hadController = Boolean(navigator.serviceWorker.controller);
  let feedbackTimer, deadlineTimer;

  function refresh() {
    const update = Boolean(registration?.waiting || needsReload), busy = isBusy();
    notice.hidden = !requested && !update && !failed;
    notice.dataset.state = requested ? 'updating' : !update ? 'failed' : busy ? 'waiting' : 'ready';
    button.hidden = requested || !update || busy;
    button.disabled = requested || busy;
    message.textContent = requested ? 'Updating…' : !update ? 'Offline setup unavailable.'
      : busy ? 'Update available when stopped.' : delayed ? 'Update did not finish. Try again.' : 'Update available.';
  }
  const retry = () => {
    clearTimeout(feedbackTimer); clearTimeout(deadlineTimer);
    requested = false; delayed = true; refresh();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    clearTimeout(feedbackTimer); clearTimeout(deadlineTimer);
    delayed = false;
    if (hadController) needsReload = true;
    hadController = true;
    // Only the requesting window may reload, after another live activity check.
    if (requested && !isBusy()) { location.reload(); return; }
    requested = false; refresh();
  });
  button.addEventListener('click', () => {
    if (isBusy() || requested || !(registration?.waiting || needsReload)) return;
    requested = true; delayed = false; refresh();
    deadlineTimer = setTimeout(retry, 10000);
    const waiting = registration?.waiting;
    feedbackTimer = setTimeout(() => {
      if (!requested) return;
      // Start can race both this feedback delay and the worker's activation.
      if (isBusy()) { retry(); return; }
      if (waiting) { try { waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); } catch { retry(); } }
      else location.reload();
    }, 350);
  });
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(reg => {
    registration = reg;
    const watch = worker => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        failed = worker.state === 'redundant' && !reg.active; refresh();
      });
    };
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    refresh();
  }).catch(() => { failed = !navigator.serviceWorker.controller; refresh(); });
  const check = () => { if (navigator.onLine) registration?.update().catch(() => {}); };
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  return { refresh };
}
