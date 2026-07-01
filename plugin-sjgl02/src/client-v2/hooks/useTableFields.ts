import { useState, useCallback } from 'react';
import type { FieldInfo } from '../types/permission';

export function useTableFields(api: any) {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFields = useCallback((tableName: string) => {
    if (!tableName) { setFields([]); return; }
    setLoading(true);
    api.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName } })
      .then((res: any) => {
        const data = res?.data?.data || [];
        setFields((Array.isArray(data) ? data : []).map((f: any) => ({
          name: f.name,
          label: (f.uiSchema?.title || f.name) + '(' + f.name + ')',
        })));
      }).catch(() => setFields([]))
      .finally(() => setLoading(false));
  }, [api]);

  return { fields, loading, loadFields };
}
