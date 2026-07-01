const VERSION = 'v1.0.62';

function apiRequest(client: any, url: string, opts: any = {}) {
  if (!client || !client.request) {
    console.warn('[sjgl02] apiRequest: client not ready for', url);
    return Promise.reject(new Error('Client not ready'));
  }
  const method = (opts.method || 'get').toLowerCase();
  return client.request({ url, method, data: opts.data, params: opts.params })
    .then((res: any) => res?.data?.data ?? res?.data ?? null)
    .catch((err: any) => {
      console.error('[sjgl02] API error:', url, err?.response?.status);
      return Promise.reject(err);
    });
}

export { VERSION, apiRequest };
