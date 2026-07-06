import { useState, useEffect } from 'react';
import { useCurrentUserContext } from '@nocobase/client-v2';

export function useTablePermission(api: any, tableName: string | undefined) {
  const [allowedModes, setAllowedModes] = useState<string[]>(['insert', 'update', 'upsert']);
  const [loading, setLoading] = useState(false);
  const ctx = (useCurrentUserContext() || {}) as any;
  const contextUser = ctx.data;

  useEffect(() => {
    if (!tableName) return;
    let cancelled = false;

    const run = async () => {
      let userId = contextUser?.data?.data?.id || contextUser?.data?.id || contextUser?.id;
      let roles: string[] = (contextUser?.roles || contextUser?.data?.roles || []).map((r: any) => r.name || '');

      if (!userId) {
        try {
          const userData = await api.request({ url: 'auth:check', method: 'get' });
          const raw = userData?.data?.data || userData?.data || {};
          userId = raw?.id;
          roles = (raw?.roles || []).map((r: any) => r.name || '');
        } catch {
          /* 忽略 */
        }
      }

      if (!userId) {
        if (!cancelled) setAllowedModes(['insert', 'update', 'upsert']);
        return;
      }

      if (roles.includes('admin') || roles.includes('root')) {
        if (!cancelled) setAllowedModes(['insert', 'update', 'upsert']);
        return;
      }

      if (!cancelled) setLoading(true);
      try {
        const res = await api.request({
          url: 'sjgl02Permissions:get',
          method: 'get',
          params: { targetType: 'user', targetId: String(userId) },
        });
        const data = res?.data?.data || {};
        const userPerm = (data.custom || []).find((p: any) => p.tableName === tableName);
        if (userPerm) {
          if (!cancelled) {
            if (userPerm.canImport && userPerm.importMode) {
              setAllowedModes(Array.isArray(userPerm.importMode) ? userPerm.importMode : [userPerm.importMode]);
            } else {
              setAllowedModes([]);
            }
          }
          return;
        }
        const rolePerms = (data.inherited || []).filter((p: any) => p.tableName === tableName && p.canImport);
        if (!cancelled) {
          if (rolePerms.length > 0) {
            const mergedModes = [
              ...new Set(
                rolePerms.flatMap((p: any) =>
                  (Array.isArray(p.importMode) ? p.importMode : [p.importMode]).filter(Boolean),
                ),
              ),
            ] as string[];
            setAllowedModes(mergedModes.length > 0 ? mergedModes : ['insert', 'update', 'upsert']);
          } else {
            setAllowedModes(['insert', 'update', 'upsert']);
          }
        }
      } catch {
        if (!cancelled) setAllowedModes(['insert', 'update', 'upsert']);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [api, tableName, contextUser]);

  return { allowedModes, loading };
}
