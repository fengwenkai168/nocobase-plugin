import { useState, useCallback } from 'react';
import type { FieldInfo } from '../types/permission';

export function useTableFields(api: any) {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFields = useCallback(
    async (tableName: string) => {
      if (!tableName) {
        setFields([]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName } });
        const data = res?.data?.data || [];
        setFields(
          (Array.isArray(data) ? data : []).map((f: any) => ({
            name: f.name,
            label: (f.uiSchema?.title || f.name) + '(' + f.name + ')',
            type: f.type,
            interface: f.interface,
            uiSchema: f.uiSchema,
            isAssociation: f.isAssociation,
          })),
        );
      } catch {
        setFields([]);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  return { fields, loading, loadFields };
}
