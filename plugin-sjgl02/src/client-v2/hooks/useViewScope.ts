import { useState, useEffect } from 'react';

export function useViewScope(api: any, target?: { type?: string; id?: string | number } | null) {
  const [viewScope, setViewScope] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params: any = {};
    if (target?.type === 'user' && target?.id) params.userId = String(target.id);
    api.request({ url: 'sjgl02Permissions:settings', method: 'get', params })
      .then((res: any) => {
        const s = res?.data?.data;
        if (s?.taskViewScope) setViewScope(s.taskViewScope);
      }).catch(() => {})
      .finally(() => setLoading(false));
  }, [api, target?.id, target?.type]);

  const handleViewScopeChange = (val: string) => {
    setViewScope(val);
    const data: any = { taskViewScope: val };
    if (target?.type === 'user' && target?.id) data.userId = String(target.id);
    api.request({ url: 'sjgl02Permissions:saveSettings', method: 'post', data }).catch(() => {});
  };

  return { viewScope, setViewScope: handleViewScopeChange, loading };
}
