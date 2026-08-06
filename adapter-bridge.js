(() => {
  const nativeFetch = window.fetch.bind(window);
  const bridgeEndpoint = 'https://link-map.oceanliners.net/api/curator-intelligence';
  const bridgedHosts = new Map([
    ['site-health.oceanliners.net', 'site-health'],
    ['search-intelligence.oceanliners.net', 'search-intelligence'],
  ]);

  let bridgePromise = null;

  async function loadBridge() {
    if (!bridgePromise) {
      bridgePromise = nativeFetch(`${bridgeEndpoint}?bridge_client=${Date.now()}`, { cache: 'no-store' })
        .then(async response => {
          if (!response.ok) throw new Error(`Link Map bridge returned ${response.status}`);
          const data = await response.json();
          if (!data?.ok) throw new Error(data?.error || 'Link Map bridge returned an invalid response');
          return data;
        })
        .catch(error => {
          bridgePromise = null;
          throw error;
        });
    }
    return bridgePromise;
  }

  window.fetch = async function curatorIntelligenceFetch(input, init) {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    } catch {
      return nativeFetch(input, init);
    }

    const adapterId = bridgedHosts.get(url.hostname);
    if (!adapterId || url.pathname !== '/api/curator-intelligence') {
      return nativeFetch(input, init);
    }

    const bridge = await loadBridge();
    const record = Array.isArray(bridge.adapters)
      ? bridge.adapters.find(item => item.id === adapterId)
      : null;

    if (!record?.ok || !record?.payload) {
      const message = record?.error || `${adapterId} is unavailable through the Link Map bridge`;
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return new Response(JSON.stringify(record.payload), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  };
})();
