import React from 'react';
import { apiRequest } from '../shared';
import { useAPI } from '../../utils/api';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';

export interface TableItem {
  name: string;
  title: string;
}

export interface PermSourceOption {
  value: string;
  label: string;
  type: string;
  id?: string;
}

export interface PermSource {
  type: string;
  id?: string;
  label?: string;
}

interface UsePermFilteredTablesOptions {
  permissionType: 'import' | 'export';
  message: any;
}

interface UsePermFilteredTablesResult {
  tables: TableItem[];
  loading: boolean;
  isAdminOrRoot: boolean;
  permSource: PermSource | null;
  permSourceOptions: PermSourceOption[];
  setPermSource: (source: PermSource | null) => void;
  setPermSourceOptions: React.Dispatch<React.SetStateAction<PermSourceOption[]>>;
  handlePermSourceChange: (val: string) => void;
}

export function usePermFilteredTables({
  permissionType,
  message,
}: UsePermFilteredTablesOptions): UsePermFilteredTablesResult {
  const client = useAPI();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [tables, setTables] = React.useState<TableItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAdminOrRoot, setIsAdminOrRoot] = React.useState(false);
  const [permSource, setPermSource] = React.useState<PermSource | null>(null);
  const [permSourceOptions, setPermSourceOptions] = React.useState<PermSourceOption[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const loadTables = async () => {
      try {
        const data = await apiRequest(client, 'sjgl02Permissions:tables');
        if (!Array.isArray(data)) return;
        const allTables = data.map((t: any) => ({ name: t.name, title: t.title || t.name }));
        if (cancelled) return;
        try {
          const userData = await apiRequest(client, 'auth:check');
          const uid = userData?.data?.id || userData?.id;
          const roles = (userData?.data?.roles || userData?.roles || []).map((r: any) => r.name || '');
          const isAdmin = roles.includes('admin') || roles.includes('root');
          setIsAdminOrRoot(isAdmin);
          if (isAdmin) {
            setPermSource({ type: 'admin' });
            try {
              const list = await apiRequest(client, 'sjgl02Permissions:userRoleList');
              const opts: PermSourceOption[] = [{ value: 'admin', label: t('Admin full permission'), type: 'admin' }];
              (list?.users || []).forEach((u: any) => {
                opts.push({
                  value: `user:${u.id}`,
                  label: `👤 ${u.nickname || u.username || u.id} — ${t('User scheme')}`,
                  type: 'user',
                  id: String(u.id),
                });
              });
              (list?.roles || []).forEach((r: any) => {
                opts.push({
                  value: `role:${r.name}`,
                  label: `👥 ${r.title || r.name} — ${t('Role scheme')}`,
                  type: 'role',
                  id: r.name,
                });
              });
              if (!cancelled) setPermSourceOptions(opts);
            } catch {
              // 忽略用户/角色列表加载失败
            }
          } else if (!cancelled) {
            setPermSource(null);
          }
          if (!uid) {
            if (!cancelled) setTables(allTables);
            return;
          }
          const permField = permissionType === 'import' ? 'canImport' : 'canExport';
          try {
            const permData = await apiRequest(client, 'sjgl02Permissions:get', {
              params: { targetType: 'user', targetId: String(uid) },
            });
            const allowedNames = new Set(
              [...(permData?.custom || []), ...(permData?.inherited || [])]
                .filter((p: any) => p[permField])
                .map((p: any) => p.tableName),
            );
            if (!cancelled) setTables(allTables.filter((t) => allowedNames.has(t.name)));
          } catch {
            if (!cancelled) setTables(allTables);
          }
        } catch {
          if (!cancelled) setTables(allTables);
        }
      } catch {
        if (!cancelled) message.error(t('Failed to load table list'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTables();
    return () => {
      cancelled = true;
    };
  }, [client, message, permissionType, t]);

  const handlePermSourceChange = React.useCallback(
    (val: string) => {
      if (val === 'admin') {
        setPermSource({ type: 'admin' });
        return;
      }
      const [type, id] = val.split(':');
      const option = permSourceOptions.find((o) => o.value === val);
      setPermSource({ type, id, label: option?.label });
    },
    [permSourceOptions],
  );

  return {
    tables,
    loading,
    isAdminOrRoot,
    permSource,
    permSourceOptions,
    setPermSource,
    setPermSourceOptions,
    handlePermSourceChange,
  };
}
