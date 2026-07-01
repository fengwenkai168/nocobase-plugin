import { useState, useEffect } from 'react';

export function useViewScope(api: any) {
  const [viewScope, setViewScope] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.request({ url: 'sjgl02Permissions:settings', method: 'get' })
      .then((res: any) => {
        const s = res?.data?.data;
        if (s?.taskViewScope) setViewScope(s.taskViewScope);
      }).catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const handleViewScopeChange = (val: string) => {
    setViewScope(val);
    api.request({ url: 'sjgl02Permissions:saveSettings', method: 'post', data: { taskViewScope: val } }).catch(() => {});
  };

  return { viewScope, setViewScope: handleViewScopeChange, loading };
}
