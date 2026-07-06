import { useState, useEffect } from 'react';

export function useViewScope(api: any, target?: { type?: string; id?: string | number } | null) {
  const [viewScope, setViewScope] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params: any = {};
    if (target?.type === 'user' && target?.id) params.userId = String(target.id);
    const run = async () => {
      try {
        const res = await api.request({ url: 'sjgl02Permissions:settings', method: 'get', params });
        const s = res?.data?.data;
        if (!cancelled && s?.taskViewScope) setViewScope(s.taskViewScope);
      } catch {
        /* 忽略 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [api, target?.id, target?.type]);

  const handleViewScopeChange = (val: string) => {
    setViewScope(val);
    const data: any = { taskViewScope: val };
    if (target?.type === 'user' && target?.id) data.userId = String(target.id);
    return api.request({ url: 'sjgl02Permissions:saveSettings', method: 'post', data }).catch(() => {});
  };

  return { viewScope, setViewScope: handleViewScopeChange, loading };
}
