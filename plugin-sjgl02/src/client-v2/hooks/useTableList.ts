import { useState, useEffect } from 'react';
import type { TableInfo } from '../types/permission';

export function useTableList(api: any) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.request({ url: 'sjgl02Permissions:tables', method: 'get' });
        const data = res?.data?.data;
        if (!cancelled && Array.isArray(data)) {
          setTables(data.map((t: any) => ({ name: t.name, title: t.title || t.name })));
        }
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
  }, [api]);

  return { tables, loading };
}
