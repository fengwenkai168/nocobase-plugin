import { useState, useEffect, useCallback, useRef } from 'react';
import type { Permission, Target, PermissionFormValues } from '../types/permission';

export function usePermissions(api: any, target: Target | null) {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSystemManaged, setIsSystemManaged] = useState(false);
  const savingRef = useRef(false);
  const savePermsRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!target) {
        setPerms([]);
        setIsSystemManaged(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.request({
          url: 'sjgl02Permissions:get',
          method: 'get',
          params: { targetType: target.type, targetId: target.id },
        });
        const d = res?.data?.data || {};
        const custom = (d.custom || []).map((p: any) => ({ ...p, _inherited: p._inherited ?? false }));
        const inherited = (d.inherited || []).map((p: any) => ({ ...p, _inherited: true }));
        const seen = new Set<string>();
        const uniqueInherited = inherited.filter((p: any) => {
          if (seen.has(p.tableName)) return false;
          seen.add(p.tableName);
          return true;
        });
        const merged = [...custom, ...uniqueInherited];
        setPerms(merged);
        setIsSystemManaged(merged.length > 0 && merged.every((p: any) => p._inherited));
      } catch {
        setPerms([]);
        setIsSystemManaged(false);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [api, target?.id, target?.type]);

  const autoSave = useCallback(
    async (updatedPerms: Permission[]) => {
      const nonInherited = updatedPerms.filter((p) => !p._inherited);
      try {
        await api.request({
          url: 'sjgl02Permissions:save',
          method: 'post',
          data: {
            permissions: nonInherited,
            targetType: target?.type || '',
            targetId: target?.id || '',
          },
        });
      } catch {
        // ignore
      }
    },
    [api, target?.type, target?.id],
  );

  const refresh = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    try {
      const res = await api.request({
        url: 'sjgl02Permissions:get',
        method: 'get',
        params: { targetType: target.type, targetId: target.id },
      });
      const d = res?.data?.data || {};
      const custom = (d.custom || []).map((p: any) => ({ ...p, _inherited: p._inherited ?? false }));
      const inherited = (d.inherited || []).map((p: any) => ({ ...p, _inherited: true }));
      const seen = new Set<string>();
      const uniqueInherited = inherited.filter((p: any) => {
        if (seen.has(p.tableName)) return false;
        seen.add(p.tableName);
        return true;
      });
      setPerms([...custom, ...uniqueInherited]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api, target?.type, target?.id]);

  const toggle = useCallback(
    (tableName: string, field: 'canImport' | 'canExport') => {
      const updated = perms.map((p) => (p.tableName === tableName && !p._inherited ? { ...p, [field]: !p[field] } : p));
      setPerms(updated);
      autoSave(updated);
    },
    [perms, autoSave],
  );

  const remove = useCallback(
    (tableName: string) => {
      const updated = perms.filter((p) => p.tableName !== tableName || p._inherited);
      setPerms(updated);
      autoSave(updated);
    },
    [perms, autoSave],
  );

  const save = useCallback(
    async (values: PermissionFormValues, editPerm?: Permission) => {
      const customPerms = perms.filter((p) => !p._inherited);
      let updated: Permission[];
      if (editPerm) {
        updated = customPerms.map((p) => (p.tableName === editPerm.tableName ? { ...p, ...values } : p));
      } else {
        updated = [
          ...customPerms,
          {
            targetType: target!.type,
            targetId: target!.id,
            targetName: target!.nickname || target!.name || '',
            ...values,
            uniqueFields: values.uniqueFields || [],
            requiredFields: values.requiredFields || [],
            importFields: values.importFields || [],
            exportFields: values.exportFields || [],
          },
        ];
      }
      const inheritedPerms = perms.filter((p) => p._inherited);
      setPerms([...updated, ...inheritedPerms]);
      try {
        await api.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: updated } });
        return true;
      } catch {
        return false;
      }
    },
    [perms, api, target],
  );

  const inheritedPerms = perms.filter((p) => p._inherited);
  const customPerms = perms.filter((p) => !p._inherited);

  return {
    perms,
    inheritedPerms,
    customPerms,
    loading,
    isSystemManaged,
    toggle,
    remove,
    save,
    refresh,
  };
}
