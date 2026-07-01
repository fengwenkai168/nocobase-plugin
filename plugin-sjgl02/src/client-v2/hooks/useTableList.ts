import { useState, useEffect } from 'react';
import type { TableInfo } from '../types/permission';

export function useTableList(api: any) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.request({ url: 'sjgl02Permissions:tables', method: 'get' })
      .then((res: any) => {
        const data = res?.data?.data;
        if (Array.isArray(data)) {
          setTables(data.map((t: any) => ({ name: t.name, title: t.title || t.name })));
        }
      }).catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  return { tables, loading };
}
