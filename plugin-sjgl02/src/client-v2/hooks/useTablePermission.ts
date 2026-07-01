import { useState, useEffect } from 'react';
import { useCurrentUserContext } from '@nocobase/client-v2';

export function useTablePermission(api: any, tableName: string | undefined) {
  const [allowedModes, setAllowedModes] = useState<string[]>(['insert', 'update', 'upsert']);
  const [loading, setLoading] = useState(false);
  const ctx = (useCurrentUserContext() || {}) as any;
  const contextUser = ctx.data;

  useEffect(() => {
    if (!tableName) return;

    const fetchPermissions = (userId: number, roles: string[]) => {
      if (roles.includes('admin') || roles.includes('root')) {
        setAllowedModes(['insert', 'update', 'upsert']);
        return;
      }
      setLoading(true);
      api.request({
        url: 'sjgl02Permissions:get',
        method: 'get',
        params: { targetType: 'user', targetId: String(userId) },
      }).then((res: any) => {
        const data = res?.data?.data || {};
        const userPerm = (data.custom || []).find((p: any) => p.tableName === tableName);
        if (userPerm) {
          if (userPerm.canImport && userPerm.importMode) {
            setAllowedModes(Array.isArray(userPerm.importMode) ? userPerm.importMode : [userPerm.importMode]);
          } else {
            setAllowedModes([]);
          }
          return;
        }
        const rolePerm = (data.inherited || []).find((p: any) => p.tableName === tableName && p.canImport);
        if (rolePerm?.importMode) {
          setAllowedModes(Array.isArray(rolePerm.importMode) ? rolePerm.importMode : [rolePerm.importMode]);
        } else {
          setAllowedModes(['insert', 'update', 'upsert']);
        }
      }).catch(() => setAllowedModes(['insert', 'update', 'upsert']))
        .finally(() => setLoading(false));
    };

    const userId = contextUser?.data?.data?.id || contextUser?.data?.id || contextUser?.id;
    if (userId) {
      const roles = (contextUser?.roles || contextUser?.data?.roles || []).map((r: any) => r.name || '');
      fetchPermissions(userId, roles);
    } else {
      api.request({ url: 'auth:check', method: 'get' }).then((userData: any) => {
        const raw = userData?.data?.data || userData?.data || {};
        const uid = raw?.id;
        const roles = (raw?.roles || []).map((r: any) => r.name || '');
        if (uid) {
          fetchPermissions(uid, roles);
        } else {
          setAllowedModes(['insert', 'update', 'upsert']);
        }
      }).catch(() => {
        setAllowedModes(['insert', 'update', 'upsert']);
      });
    }
  }, [api, tableName, contextUser]);

  return { allowedModes, loading };
}
