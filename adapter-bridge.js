(() => {
  const nativeFetch = window.fetch.bind(window);
  const scriptAdapters = new Map([
    ['site-health.oceanliners.net', 'site-health'],
    ['search-intelligence.oceanliners.net', 'search-intelligence'],
    ['integrity.oceanliners.net', 'integrity'],
  ]);

  let seq = 0;

  function loadViaScript(url, adapterId) {
    return new Promise((resolve, reject) => {
      const callbackName = `__curatorAdapter_${adapterId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}_${++seq}`;
      const script = document.createElement('script');
      const timeout = setTimeout(() => cleanup(new Error(`${adapterId} script adapter timed out`)), 12000);

      function cleanup(error, payload) {
        clearTimeout(timeout);
        try { delete window[callbackName]; } catch { window[callbackName] = undefined; }
        script.remove();
        if (error) reject(error); else resolve(payload);
      }

      window[callbackName] = payload => {
        if (!payload?.ok || !payload?.system) {
          cleanup(new Error(payload?.error || `${adapterId} returned an invalid intelligence signal`));
          return;
        }
        cleanup(null, payload);
      };

      script.onerror = () => cleanup(new Error(`${adapterId} script adapter failed to load`));
      const next = new URL(url.toString());
      next.searchParams.set('callback', callbackName);
      next.searchParams.set('t', Date.now());
      script.src = next.toString();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  window.fetch = async function curatorIntelligenceFetch(input, init) {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    } catch {
      return nativeFetch(input, init);
    }

    const adapterId = scriptAdapters.get(url.hostname);
    if (!adapterId || url.pathname !== '/api/curator-intelligence') {
      return nativeFetch(input, init);
    }

    try {
      const payload = await loadViaScript(url, adapterId);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
  };
})();
