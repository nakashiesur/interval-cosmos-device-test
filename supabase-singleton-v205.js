(() => {
  // INTERVAL COSMOS v2.0.5 — one Supabase client per browser context.
  // Loaded before cloud.js so every later createClient(url,key,...) call shares
  // the same GoTrue storage owner and avoids competing auth clients.
  let sdkValue = window.supabase;
  let singleton = null;

  function wrapSdk(sdk) {
    if (!sdk?.createClient || sdk.__intervalCosmosSingletonWrapped) return sdk;
    const original = sdk.createClient.bind(sdk);
    const wrapped = function(url, key, options) {
      const u = String(url || '');
      const k = String(key || '');
      if (singleton && singleton.url === u && singleton.key === k) {
        return singleton.client;
      }
      const client = original(url, key, options);
      singleton = { url:u, key:k, client };
      return client;
    };
    try {
      Object.defineProperty(sdk, '__intervalCosmosOriginalCreateClient', {
        value: original, configurable: false, enumerable: false, writable: false,
      });
      Object.defineProperty(sdk, '__intervalCosmosSingletonWrapped', {
        value: true, configurable: false, enumerable: false, writable: false,
      });
      sdk.createClient = wrapped;
    } catch {
      sdk.createClient = wrapped;
      sdk.__intervalCosmosSingletonWrapped = true;
    }
    return sdk;
  }

  if (sdkValue) sdkValue = wrapSdk(sdkValue);

  let installedSetter = false;
  try {
    const desc = Object.getOwnPropertyDescriptor(window, 'supabase');
    if (!desc || desc.configurable) {
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        enumerable: true,
        get() { return sdkValue; },
        set(value) { sdkValue = wrapSdk(value); },
      });
      installedSetter = true;
    }
  } catch {}

  if (!installedSetter) {
    const timer = window.setInterval(() => {
      if (!window.supabase?.createClient) return;
      wrapSdk(window.supabase);
      window.clearInterval(timer);
    }, 25);
    window.setTimeout(() => window.clearInterval(timer), 10000);
  }

  window.IntervalCosmosSupabaseSingleton = {
    getClient: () => singleton?.client || null,
    isActive: () => Boolean(singleton?.client),
  };
})();
