const ANALYTICS_STATE = '__tcpGoogleAnalytics';

function pageFields(document, window, referrer) {
  return {
    page_location: window.location.href,
    page_title: document.title,
    page_referrer: referrer,
  };
}

/**
 * Queue GA immediately, then fetch the third-party runtime after first paint.
 * The bounded idle wait still records passive visits, while navigation and
 * page-hiding events request the runtime sooner when the page is leaving.
 */
export function installGoogleAnalytics({ document, window, measurementId, idleTimeout = 2_000 }) {
  if (window[ANALYTICS_STATE]) return window[ANALYTICS_STATE];

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      // biome-ignore lint/complexity/noArguments: gtag.js expects its canonical Arguments queue entries.
      window.dataLayer.push(arguments);
    };

  const initialLocation = window.location.href;
  let lastTrackedLocation = initialLocation;
  let navigationHeld = false;
  let frameId;
  let idleId;
  let timerId;

  const state = {
    loaded: false,
    requested: false,
    load: undefined,
  };
  window[ANALYTICS_STATE] = state;

  window.gtag('js', new Date());
  window.gtag('config', measurementId, pageFields(document, window, document.referrer));

  const cancelScheduledLoad = () => {
    if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
    if (timerId !== undefined) window.clearTimeout(timerId);
    frameId = undefined;
    idleId = undefined;
    timerId = undefined;
  };

  const load = () => {
    if (state.requested) return;
    cancelScheduledLoad();
    state.requested = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.addEventListener(
      'load',
      () => {
        state.loaded = true;
      },
      { once: true },
    );
    document.head.append(script);
  };
  state.load = load;

  const scheduleIdleLoad = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(load, { timeout: idleTimeout });
    } else {
      timerId = window.setTimeout(load, 0);
    }
  };
  const afterFirstPaint = () => {
    frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(scheduleIdleLoad);
    });
  };
  if (document.visibilityState === 'hidden') load();
  else afterFirstPaint();

  document.addEventListener('astro:before-preparation', () => {
    if (state.loaded) return;
    navigationHeld = true;
    // A requested script cannot observe history until its download has finished.
    // Keep queuing visits during that gap without starting a second download.
    if (state.requested) return;
    cancelScheduledLoad();
    // A cancelled or failed transition may never emit astro:page-load.
    timerId = window.setTimeout(load, idleTimeout);
  });
  document.addEventListener('astro:page-load', () => {
    if (!navigationHeld || state.loaded) return;
    navigationHeld = false;

    const nextLocation = window.location.href;
    if (nextLocation !== lastTrackedLocation) {
      window.gtag('event', 'page_view', pageFields(document, window, lastTrackedLocation));
      lastTrackedLocation = nextLocation;
    }
    load();
  });
  window.addEventListener('pagehide', load, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') load();
  });

  return state;
}
