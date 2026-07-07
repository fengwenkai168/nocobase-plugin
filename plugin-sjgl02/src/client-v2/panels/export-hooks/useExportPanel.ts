import React from 'react';
import { apiRequest } from '../shared';
import { useAPI } from '../../utils/api';
import { usePermFilteredTables } from '../shared-hooks';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
import type { ExportTableItem, ExportFieldItem } from './exportTypes';
import { optionsEqual } from './exportTypes';

export function useExportPanel(message: any) {
  const client = useAPI();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [step, setStep] = React.useState(0);
  const [selTable, setSelTable] = React.useState('');
  const [isAllTables, setIsAllTables] = React.useState(false);
  const [fields, setFields] = React.useState<ExportFieldItem[]>([]);
  const [selFields, setSelFields] = React.useState<string[]>([]);
  const [fileName, setFileName] = React.useState('{表名}_{日期}.xlsx');
  const [includeAssocSheet, setIncludeAssocSheet] = React.useState(false);
  const [selectedAssocTables, setSelectedAssocTables] = React.useState<string[]>([]);
  const [includeAttachments, setIncludeAttachments] = React.useState(false);
  const [estimatedRows, setEstimatedRows] = React.useState<number | null>(null);
  const [headerStyle, setHeaderStyle] = React.useState<string>('title_id');

  const {
    tables,
    loading,
    isAdminOrRoot,
    permSource,
    permSourceOptions,
    setPermSource,
    setPermSourceOptions,
    handlePermSourceChange,
  } = usePermFilteredTables({ permissionType: 'export', message });

  const handleSelectTable = React.useCallback((val: string) => {
    setSelTable(val);
    setIsAllTables(val === '__all__');
  }, []);

  const toggleField = React.useCallback((name: string) => {
    setSelFields((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]));
  }, []);

  React.useEffect(() => {
    if (!selTable || selTable === '__all__' || !isAdminOrRoot) return;
    let cancelled = false;
    const filterOptions = async () => {
      const allOpts = permSourceOptions.length > 0 ? permSourceOptions : [];
      if (allOpts.length === 0) return;
      const base = [{ value: 'admin', label: t('Admin full permission'), type: 'admin' }];
      for (const o of allOpts.filter((o: any) => o.type !== 'admin')) {
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
      setPermSourceOptions((prev: any) => (optionsEqual(prev, base) ? prev : base));
      const currentVal =
        permSource?.type === 'admin' ? 'admin' : permSource ? `${permSource.type}:${permSource.id}` : 'admin';
      if (!base.some((o: any) => o.value === currentVal)) {
        setPermSource({ type: 'admin', label: t('Admin full permission') });
      }
    };
    filterOptions().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isAdminOrRoot, permSource?.type, permSource?.id, permSourceOptions, selTable]);

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
        title: t('Confirm export'),
        content: isAllTables
          ? t('All tables exported asynchronously')
          : includeAttachments
            ? t('Zip attachments exported asynchronously')
            : t('Xlsx exported asynchronously'),
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
            message.success(t('Export task submitted'));
            setStep(0);
          } catch {
            message.error(t('Submit failed'));
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
      t,
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
