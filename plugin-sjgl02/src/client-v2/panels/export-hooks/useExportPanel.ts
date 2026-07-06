import React from 'react';
import { apiRequest } from '../shared';
import { useAPI } from '../../utils/api';
import type { ExportTableItem, PermSourceOption, ExportFieldItem } from './exportTypes';
import { optionsEqual } from './exportTypes';

export function useExportPanel(message: any) {
  const client = useAPI();
  const [step, setStep] = React.useState(0);
  const [tables, setTables] = React.useState<ExportTableItem[]>([]);
  const [selTable, setSelTable] = React.useState('');
  const [isAllTables, setIsAllTables] = React.useState(false);
  const [isAdminOrRoot, setIsAdminOrRoot] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [fields, setFields] = React.useState<ExportFieldItem[]>([]);
  const [selFields, setSelFields] = React.useState<string[]>([]);
  const [fileName, setFileName] = React.useState('{表名}_{日期}.xlsx');
  const [includeAssocSheet, setIncludeAssocSheet] = React.useState(false);
  const [selectedAssocTables, setSelectedAssocTables] = React.useState<string[]>([]);
  const [includeAttachments, setIncludeAttachments] = React.useState(false);
  const [estimatedRows, setEstimatedRows] = React.useState<number | null>(null);
  const [headerStyle, setHeaderStyle] = React.useState<string>('title_id');
  const [permSource, setPermSource] = React.useState<{ type: string; id?: string; label?: string } | null>(null);
  const [permSourceOptions, setPermSourceOptions] = React.useState<PermSourceOption[]>([]);

  const handleSelectTable = React.useCallback((val: string) => {
    setSelTable(val);
    setIsAllTables(val === '__all__');
  }, []);

  const toggleField = React.useCallback((name: string) => {
    setSelFields((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const loadTables = async () => {
      try {
        const data = await apiRequest(client, 'sjgl02Permissions:tables');
        if (!Array.isArray(data)) return;
        const allTables = data.map((t: any) => ({ name: t.name, title: t.title || t.name }));
        try {
          const userData = await apiRequest(client, 'auth:check');
          const uid = userData?.data?.id || userData?.id;
          const roles = (userData?.data?.roles || userData?.roles || []).map((r: any) => r.name || '');
          if (roles.includes('admin') || roles.includes('root') || !uid) {
            if (!cancelled) setTables(allTables);
            return;
          }
          const permData = await apiRequest(client, 'sjgl02Permissions:get', {
            params: { targetType: 'user', targetId: String(uid) },
          });
          const allowedNames = new Set(
            [...(permData?.custom || []), ...(permData?.inherited || [])]
              .filter((p: any) => p.canExport)
              .map((p: any) => p.tableName),
          );
          if (!cancelled) setTables(allTables.filter((t) => allowedNames.has(t.name)));
        } catch {
          if (!cancelled) setTables(allTables);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const loadUserInfo = async () => {
      try {
        const userData = await apiRequest(client, 'auth:check');
        const roles = (userData?.data?.roles || userData?.roles || []).map((r: any) => r.name || '');
        const isAdmin = roles.includes('admin') || roles.includes('root');
        const uid = userData?.data?.id || userData?.id;
        if (!cancelled) setIsAdminOrRoot(isAdmin);
        try {
          const list = await apiRequest(client, 'sjgl02Permissions:userRoleList');
          const opts: PermSourceOption[] = [];
          if (isAdmin) {
            opts.push({ value: 'admin', label: '管理员完整权限', type: 'admin' });
          }
          if (!isAdmin && uid) {
            opts.push({
              value: `user:${uid}`,
              label: '👤 当前用户 — 用户方案',
              type: 'user',
              id: String(uid),
            });
          }
          (list?.users || []).forEach((u: any) => {
            if (isAdmin || String(u.id) === String(uid)) {
              opts.push({
                value: `user:${u.id}`,
                label: `👤 ${u.nickname || u.username || u.id} — 用户方案`,
                type: 'user',
                id: String(u.id),
              });
            }
          });
          (list?.roles || []).forEach((r: any) => {
            if (isAdmin || roles.includes(r.name)) {
              opts.push({
                value: `role:${r.name}`,
                label: `👥 ${r.title || r.name} — 角色方案`,
                type: 'role',
                id: r.name,
              });
            }
          });
          if (!cancelled) setPermSourceOptions(opts);
          if (!cancelled) {
            if (isAdmin) {
              setPermSource({ type: 'admin', label: '管理员完整权限' });
            } else if (opts.length > 0) {
              const first = opts[0];
              setPermSource({ type: first.type, id: first.id, label: first.label });
            }
          }
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    };
    loadTables().catch(() => {});
    loadUserInfo().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  React.useEffect(() => {
    if (!selTable || selTable === '__all__' || !isAdminOrRoot) return;
    let cancelled = false;
    const filterOptions = async () => {
      const allOpts = permSourceOptions.length > 0 ? permSourceOptions : [];
      if (allOpts.length === 0) return;
      const base: PermSourceOption[] = [{ value: 'admin', label: '管理员完整权限', type: 'admin' }];
      for (const o of allOpts.filter((o) => o.type !== 'admin')) {
        try {
          const res = await apiRequest(client, 'sjgl02Permissions:get', {
            params: { targetType: o.type, targetId: o.id },
          });
          const perms = (res?.custom || []).concat(res?.inherited || []);
          if (perms.some((p: any) => p.tableName === selTable && p.canExport)) base.push(o);
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      setPermSourceOptions((prev) => (optionsEqual(prev, base) ? prev : base));
      const currentVal =
        permSource?.type === 'admin' ? 'admin' : permSource ? `${permSource.type}:${permSource.id}` : 'admin';
      if (!base.some((o) => o.value === currentVal)) {
        setPermSource({ type: 'admin', label: '管理员完整权限' });
      }
    };
    filterOptions().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isAdminOrRoot, permSource?.type, permSource?.id, permSourceOptions, selTable]);

  const handlePermSourceChange = React.useCallback(
    async (val: string) => {
      if (val === 'admin') {
        setPermSource({ type: 'admin', label: '管理员完整权限' });
        return;
      }
      const [type, id] = val.split(':');
      const option = permSourceOptions.find((o) => o.value === val);
      setPermSource({ type, id, label: option?.label });
    },
    [permSourceOptions],
  );

  React.useEffect(() => {
    if (!selTable || selTable === '__all__') return;
    let cancelled = false;
    const loadFieldsForPermSource = async () => {
      try {
        const res = await client.request({
          url: 'sjgl02Export:tableFields',
          method: 'get',
          params: { tableName: selTable },
        });
        const fArr = res?.data?.data || [];
        if (!Array.isArray(fArr)) return;
        const allFields = fArr.map((f: any) => ({ ...f, displayName: f.name }));
        if (!permSource || permSource.type === 'admin') {
          if (!cancelled) {
            setFields(allFields);
            setSelFields(allFields.map((f: any) => f.name));
          }
          return;
        }
        try {
          const permData = await apiRequest(client, 'sjgl02Permissions:get', {
            params: { targetType: permSource.type, targetId: permSource.id },
          });
          const perm = (permData?.custom || [])
            .concat(permData?.inherited || [])
            .find((p: any) => p.tableName === selTable);
          if (!cancelled) {
            if (perm?.canExport && perm?.exportFields?.length > 0) {
              const filtered = allFields.filter((f: any) => perm.exportFields.includes(f.name));
              setFields(filtered);
              setSelFields(filtered.map((f: any) => f.name));
            } else {
              setFields(allFields);
              setSelFields(allFields.map((f: any) => f.name));
            }
          }
        } catch {
          if (!cancelled) {
            setFields(allFields);
            setSelFields(allFields.map((f: any) => f.name));
          }
        }
      } catch {
        // ignore
      }
    };
    loadFieldsForPermSource().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, permSource?.type, permSource?.id, selTable]);

  React.useEffect(() => {
    if (!selTable) return;
    let cancelled = false;
    const load = async () => {
      if (selTable !== '__all__') {
        try {
          const res = await client.request({
            url: 'sjgl02Export:tableFields',
            method: 'get',
            params: { tableName: selTable },
          });
          const fArr = res?.data?.data || [];
          if (!Array.isArray(fArr) || cancelled) return;
          const allFields = fArr.map((f: any) => ({ ...f, displayName: f.name }));
          try {
            const userData = await apiRequest(client, 'auth:check');
            const uid = userData?.data?.id || userData?.id;
            const roles = (userData?.roles || userData?.data?.roles || []).map((r: any) => r.name || '');
            if (roles.includes('admin') || roles.includes('root')) {
              if (!permSource || permSource.type === 'admin') {
                if (!cancelled) {
                  setFields(allFields);
                  setSelFields(allFields.map((f: any) => f.name));
                }
                return;
              }
              try {
                const permData = await apiRequest(client, 'sjgl02Permissions:get', {
                  params: { targetType: permSource.type, targetId: permSource.id },
                });
                const perm = (permData?.custom || [])
                  .concat(permData?.inherited || [])
                  .find((p: any) => p.tableName === selTable);
                if (!cancelled) {
                  if (perm?.canExport && perm?.exportFields?.length > 0) {
                    const filtered = allFields.filter((f: any) => perm.exportFields.includes(f.name));
                    setFields(filtered);
                    setSelFields(filtered.map((f: any) => f.name));
                  } else {
                    setFields(allFields);
                    setSelFields(allFields.map((f: any) => f.name));
                  }
                }
              } catch {
                if (!cancelled) {
                  setFields(allFields);
                  setSelFields(allFields.map((f: any) => f.name));
                }
              }
              return;
            }
            if (!uid) {
              if (!cancelled) {
                setFields(allFields);
                setSelFields(allFields.map((f: any) => f.name));
              }
              return;
            }
            try {
              const permData = await apiRequest(client, 'sjgl02Permissions:get', {
                params: { targetType: 'user', targetId: String(uid) },
              });
              const perms = [...(permData?.custom || []), ...(permData?.inherited || [])];
              const perm = perms.find((p: any) => p.tableName === selTable && p.canExport);
              if (!cancelled) {
                if (perm?.exportFields?.length > 0) {
                  const filtered = allFields.filter((f: any) => perm.exportFields.includes(f.name));
                  setFields(filtered);
                  setSelFields(filtered.map((f: any) => f.name));
                } else {
                  setFields(allFields);
                  setSelFields(allFields.map((f: any) => f.name));
                }
              }
            } catch {
              if (!cancelled) {
                setFields(allFields);
                setSelFields(allFields.map((f: any) => f.name));
              }
            }
          } catch {
            if (!cancelled) {
              setFields(allFields);
              setSelFields(allFields.map((f: any) => f.name));
            }
          }
        } catch {
          // ignore
        }
        try {
          const res = await client.request({
            url: 'sjgl02Export:previewCount',
            method: 'post',
            data: { tableName: selTable, permSource: permSource || null },
          });
          const c = res?.data?.data?.estimatedRows;
          if (!cancelled && typeof c === 'number') setEstimatedRows(c);
        } catch {
          // ignore
        }
      } else {
        try {
          const res = await client.request({
            url: 'sjgl02Export:previewCount',
            method: 'post',
            data: { tableName: '__all__' },
          });
          const c = res?.data?.data?.estimatedRows;
          if (!cancelled && typeof c === 'number') setEstimatedRows(c);
        } catch {
          // ignore
        }
      }
    };
    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, permSource, selTable]);

  const handleExport = React.useCallback(
    (confirm: any) => {
      confirm({
        title: '确认导出',
        content: isAllTables
          ? '将导出全部数据表，任务在后台异步执行'
          : includeAttachments
            ? '将生成 .zip 压缩包（含附件文件），任务在后台异步执行'
            : '将生成 .xlsx 文件，任务在后台异步执行',
        onOk: async () => {
          try {
            await client.request({
              url: 'sjgl02Export:execute',
              method: 'post',
              data: {
                tableName: selTable,
                selectedFields: isAllTables ? [] : selFields,
                fileNameTemplate: fileName,
                includeAssociationSheet: includeAssocSheet,
                associationSheetTables: selectedAssocTables,
                includeAttachments,
                headerStyle,
                permSource: permSource || null,
              },
            });
            message.success('导出任务已提交，请在任务管理中查看进度和下载');
            setStep(0);
          } catch {
            message.error('提交失败');
          }
        },
      });
    },
    [
      client,
      message,
      fileName,
      headerStyle,
      includeAssocSheet,
      includeAttachments,
      isAllTables,
      permSource,
      selFields,
      selTable,
      selectedAssocTables,
    ],
  );

  return {
    step,
    setStep,
    tables,
    loading,
    selTable,
    handleSelectTable,
    isAllTables,
    isAdminOrRoot,
    fields,
    selFields,
    setSelFields,
    toggleField,
    fileName,
    setFileName,
    includeAssocSheet,
    setIncludeAssocSheet,
    selectedAssocTables,
    setSelectedAssocTables,
    includeAttachments,
    setIncludeAttachments,
    estimatedRows,
    headerStyle,
    setHeaderStyle,
    permSource,
    permSourceOptions,
    handlePermSourceChange,
    handleExport,
  };
}
