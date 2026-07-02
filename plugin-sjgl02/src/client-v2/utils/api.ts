import { useMemo } from 'react';
import { useApp } from '@nocobase/client-v2';

export function useAPI() {
  const app = useApp();
  return useMemo(() => {
    return (app as any).apiClient || app;
  }, [app]);
}
