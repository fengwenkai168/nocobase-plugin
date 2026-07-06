import { useState, useEffect } from 'react';
import type { Target } from '../types/permission';

export function useTargetList(api: any) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.request({ url: 'sjgl02Permissions:userRoleList', method: 'get' });
        const data = res?.data?.data;
        if (!cancelled && data) {
          const users = (data.users || []).map((u: any) => ({
            id: String(u.id),
            nickname: u.nickname || u.name || '',
            type: 'user' as const,
            roles: u.roles || [],
          }));
          const roles = (data.roles || [])
            .map((r: any) => ({
              id: String(r.id || r.name),
              nickname: r.title || r.name,
              name: r.name,
              type: 'role' as const,
            }))
            .filter((r: any) => r.id);
          setTargets([...users, ...roles]);
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

  return { targets, loading };
}
