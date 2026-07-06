import React from 'react';
import { apiRequest } from '../shared';
import { useAPI } from '../../utils/api';
import type { ImportTableItem, PermSourceOption } from './importTypes';

export function useImportPanel(message: any) {
  const client = useAPI();
  const [step, setStep] = React.useState(0);
  const [selectedTable, setSelectedTable] = React.useState<ImportTableItem | null>(null);
  const [importMode, setImportMode] = React.useState('insert');
  const [allowedModes, setAllowedModes] = React.useState<string[]>(['insert', 'update', 'upsert']);
  const [uploadedFileId, setUploadedFileId] = React.useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = React.useState('');
  const [tableFields, setTableFields] = React.useState<any[]>([]);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [uniqueFields, setUniqueFields] = React.useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = React.useState<Record<string, string>>({});
  const [customValues, setCustomValues] = React.useState<Record<string, string>>({});
  const [excelHeaders, setExcelHeaders] = React.useState<string[]>([]);
  const [sheetName, setSheetName] = React.useState('Sheet1');
  const [headerRow, setHeaderRow] = React.useState(1);
  const [availSheets, setAvailSheets] = React.useState<string[]>(['Sheet1']);
  const [previewModal, setPreviewModal] = React.useState(false);
  const [blankCellMode, setBlankCellMode] = React.useState('update');
  const [isAdminOrRoot, setIsAdminOrRoot] = React.useState(false);
  const [permSource, setPermSource] = React.useState<{ type: string; id?: string; label?: string } | null>(null);
  const [permSourceOptions, setPermSourceOptions] = React.useState<PermSourceOption[]>([]);
  const [previewMeta, setPreviewMeta] = React.useState<any>(null);
  const [tables, setTables] = React.useState<ImportTableItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [permUniqueFields, setPermUniqueFields] = React.useState<string[]>([]);
  const [permRequiredFields, setPermRequiredFields] = React.useState<string[]>([]);
  const [permImportFields, setPermImportFields] = React.useState<string[]>([]);
  const [autoMatchFlag, setAutoMatchFlag] = React.useState(false);
  const [matchInfo, setMatchInfo] = React.useState('');

  const resetFileState = React.useCallback(() => {
    setUploadedFileId(null);
    setUploadedFileName('');
    setExcelHeaders([]);
    setFieldMapping({});
    setPreviewData(null);
    setCustomValues({});
    setAvailSheets(['Sheet1']);
  }, []);

  const doParse = React.useCallback(async () => {
    if (!uploadedFileId) return;
    setFieldMapping({});
    setCustomValues({});
    setUniqueFields(permUniqueFields.length > 0 ? permUniqueFields : uniqueFields);
    try {
      const pr = await client.request({
        url: 'sjgl02Import:uploadParse',
        method: 'post',
        data: { fileId: uploadedFileId, sheetName, headerRow },
      });
      const pd = pr?.data?.data;
      if (pd?.headerColumns) setExcelHeaders(pd.headerColumns);
      if (pd?.sheets) setAvailSheets(pd.sheets);
      setPreviewMeta(pd);
    } catch {
      setExcelHeaders([]);
      setAvailSheets([]);
      setPreviewMeta(null);
    }
  }, [client, uploadedFileId, sheetName, headerRow, permUniqueFields, uniqueFields]);

  React.useEffect(() => {
    doParse();
  }, [doParse]);

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
              const opts: PermSourceOption[] = [{ value: 'admin', label: '管理员完整权限', type: 'admin' }];
              (list?.users || []).forEach((u: any) => {
                opts.push({
                  value: `user:${u.id}`,
                  label: `👤 ${u.nickname || u.username || u.id} — 用户方案`,
                  type: 'user',
                  id: String(u.id),
                });
              });
              (list?.roles || []).forEach((r: any) => {
                opts.push({
                  value: `role:${r.name}`,
                  label: `👥 ${r.title || r.name} — 角色方案`,
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
          try {
            const permData = await apiRequest(client, 'sjgl02Permissions:get', {
              params: { targetType: 'user', targetId: String(uid) },
            });
            const allowedNames = new Set(
              [...(permData?.custom || []), ...(permData?.inherited || [])]
                .filter((p: any) => p.canImport)
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
        if (!cancelled) message.error('加载表列表失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTables();
    return () => {
      cancelled = true;
    };
  }, [client, message]);

  React.useEffect(() => {
    if (!selectedTable?.name || !isAdminOrRoot) return;
    const allOpts = permSourceOptions.length > 0 ? permSourceOptions : [];
    if (allOpts.length === 0) return;
    let cancelled = false;
    const filterOptions = async () => {
      const base: PermSourceOption[] = [{ value: 'admin', label: '管理员完整权限', type: 'admin' }];
      for (const o of allOpts.filter((o) => o.type !== 'admin')) {
        try {
          const res = await apiRequest(client, 'sjgl02Permissions:get', {
            params: { targetType: o.type, targetId: o.id },
          });
          const perms = (res?.custom || []).concat(res?.inherited || []);
          if (perms.some((p: any) => p.tableName === selectedTable.name && p.canImport)) base.push(o);
        } catch {
          // 忽略单个方案查询失败
        }
      }
      if (!cancelled) setPermSourceOptions(base);
    };
    filterOptions();
    return () => {
      cancelled = true;
    };
  }, [selectedTable?.name, isAdminOrRoot, client, permSourceOptions]);

  React.useEffect(() => {
    if (!selectedTable?.name) return;
    let cancelled = false;
    const loadFields = async () => {
      try {
        const res = await client.request({
          url: 'sjgl02Import:tableFields',
          method: 'get',
          params: { tableName: selectedTable.name },
        });
        const fields = res?.data?.data || [];
        if (!cancelled) setTableFields(Array.isArray(fields) ? fields : []);
      } catch {
        // 忽略字段加载失败
      }
    };
    loadFields();
    return () => {
      cancelled = true;
    };
  }, [selectedTable?.name, client]);

  const loadPermissions = React.useCallback(async () => {
    if (!selectedTable?.name) return;
    try {
      const userData = await apiRequest(client, 'auth:check');
      const currentUserId = userData?.data?.id || userData?.id;
      const roles = (userData?.roles || userData?.data?.roles || []).map((r: any) => r.name || '');
      if (roles.includes('admin') || roles.includes('root')) {
        if (permSource && permSource.type !== 'admin' && permSource.id) {
          try {
            const permData = await apiRequest(client, 'sjgl02Permissions:get', {
              params: { targetType: permSource.type, targetId: permSource.id },
            });
            const perm = (permData?.custom || []).find((p: any) => p.tableName === selectedTable.name);
            const modes = perm?.importMode || ['insert', 'update', 'upsert'];
            const modeList = Array.isArray(modes) ? modes : [modes];
            setAllowedModes(perm?.canImport && perm.importMode ? modeList : ['insert', 'update', 'upsert']);
            setImportMode(modeList.includes('upsert') ? 'upsert' : modeList.includes('update') ? 'update' : 'insert');
            setPermUniqueFields(perm?.uniqueFields || []);
            setPermRequiredFields(perm?.requiredFields || []);
            setPermImportFields(perm?.importFields || []);
            if (perm?.uniqueFields?.length > 0) setUniqueFields(perm.uniqueFields);
          } catch {
            setAllowedModes(['insert', 'update', 'upsert']);
            setPermUniqueFields([]);
            setPermRequiredFields([]);
            setPermImportFields([]);
          }
        } else {
          setAllowedModes(['insert', 'update', 'upsert']);
          setImportMode('upsert');
          setPermUniqueFields([]);
          setPermRequiredFields([]);
          setPermImportFields([]);
        }
        return;
      }
      if (!currentUserId) {
        setAllowedModes(['insert', 'update', 'upsert']);
        return;
      }
      const permData = await apiRequest(client, 'sjgl02Permissions:get', {
        params: { targetType: 'user', targetId: String(currentUserId) },
      });
      const userPerm = (permData?.custom || []).find((p: any) => p.tableName === selectedTable.name);
      const rolePerm = (permData?.inherited || []).find((p: any) => p.tableName === selectedTable.name && p.canImport);
      const effectivePerm = userPerm || rolePerm;
      if (userPerm) {
        if (userPerm.canImport && userPerm.importMode) {
          setAllowedModes(Array.isArray(userPerm.importMode) ? userPerm.importMode : [userPerm.importMode]);
        } else {
          setAllowedModes([]);
        }
      } else if (rolePerm) {
        const modes = rolePerm.importMode;
        setAllowedModes(Array.isArray(modes) && modes.length > 0 ? modes : ['insert', 'update', 'upsert']);
      } else {
        setAllowedModes(['insert', 'update', 'upsert']);
      }
      const modes = userPerm?.importMode || rolePerm?.importMode || ['insert', 'update', 'upsert'];
      const modeList = Array.isArray(modes) ? modes : [modes];
      const pickMode = (list: string[]) => {
        if (list.includes('upsert')) return 'upsert';
        if (list.includes('update')) return 'update';
        if (list.includes('insert')) return 'insert';
        return 'insert';
      };
      setImportMode(pickMode(modeList));
      if (effectivePerm) {
        setPermUniqueFields(effectivePerm.uniqueFields || []);
        setPermRequiredFields(effectivePerm.requiredFields || []);
        setPermImportFields(effectivePerm.importFields || []);
        if (effectivePerm.uniqueFields?.length > 0) setUniqueFields(effectivePerm.uniqueFields);
      } else {
        setPermUniqueFields([]);
        setPermRequiredFields([]);
        setPermImportFields([]);
      }
    } catch {
      setAllowedModes(['insert', 'update', 'upsert']);
    }
  }, [client, permSource, selectedTable?.name]);

  React.useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const handlePermSourceChange = React.useCallback(
    (val: string) => {
      if (val === 'admin') {
        setPermSource({ type: 'admin' });
        return;
      }
      const [type, id] = val.split(':');
      const option = permSourceOptions.find((o) => o.value === val);
      setPermSource({ type, id, label: option?.label });
      setFieldMapping({});
      setCustomValues({});
    },
    [permSourceOptions],
  );

  const handleFileSelect = React.useCallback(
    async (info: any) => {
      if (info.file.status === 'done') {
        const resp = info.file.response;
        const fileId = resp?.id;
        if (fileId) {
          setUploadedFileId(fileId);
          setUploadedFileName(info.file.name);
          message.success(`${info.file.name} 上传成功`);
          try {
            const pr = await client.request({
              url: 'sjgl02Import:uploadParse',
              method: 'post',
              data: { fileId },
            });
            const pd = pr?.data?.data;
            if (pd?.headerColumns) {
              setExcelHeaders(pd.headerColumns);
              setAutoMatchFlag(true);
            }
            if (pd?.sheets) {
              setAvailSheets(pd.sheets);
              if (pd.sheets[0]) setSheetName(pd.sheets[0]);
            }
            setPreviewMeta(pd);
            if (permUniqueFields.length > 0) setUniqueFields(permUniqueFields);
          } catch {
            setExcelHeaders([]);
            setAvailSheets(['Sheet1']);
            setPreviewMeta(null);
          }
        } else {
          message.error('上传响应中未找到文件ID');
        }
      } else if (info.file.status === 'error') {
        message.error('上传失败，请重试');
      }
    },
    [client, message, permUniqueFields],
  );

  const handlePreview = React.useCallback(async () => {
    if (!uploadedFileId) return;
    try {
      const res = await client.request({
        url: 'sjgl02Import:preview',
        method: 'get',
        params: { fileId: uploadedFileId, sheetName, headerRow },
      });
      setPreviewData(res?.data?.data || null);
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.[0]?.message || err?.message || '预览失败';
      message.error(msg);
    }
  }, [client, message, uploadedFileId, sheetName, headerRow]);

  const handleAutoMatch = React.useCallback(() => {
    const mapping: Record<string, string> = {};
    const allowedSet = permImportFields.length > 0 ? new Set(permImportFields) : null;
    let matched = 0;
    let unmatched = 0;
    tableFields.forEach((f) => {
      if (allowedSet && !allowedSet.has(f.name)) return;
      const title = f.uiSchema?.title || '';
      const match = excelHeaders.find(
        (h: string) =>
          h === f.name ||
          h.toLowerCase() === f.name.toLowerCase() ||
          (title && (h === title || h.toLowerCase() === title.toLowerCase())) ||
          (() => {
            const m = h.match(/\(([^)]+)\)$/);
            return m && (m[1] === f.name || m[1].toLowerCase() === f.name.toLowerCase());
          })() ||
          h.includes(f.name) ||
          (title && h.includes(title)),
      );
      if (match) {
        mapping[f.name] = match;
        matched++;
      } else if (permRequiredFields.includes(f.name) || permUniqueFields.includes(f.name)) {
        mapping[f.name] = '__custom__';
        unmatched++;
      } else {
        unmatched++;
      }
    });
    permUniqueFields.forEach((uf) => {
      if (!mapping[uf]) mapping[uf] = '__custom__';
    });
    setFieldMapping(mapping);
    setMatchInfo(`${matched}成功/${unmatched}未匹配`);
  }, [excelHeaders, permImportFields, permRequiredFields, permUniqueFields, tableFields]);

  React.useEffect(() => {
    if (autoMatchFlag && excelHeaders.length > 0 && tableFields.length > 0) {
      handleAutoMatch();
      setAutoMatchFlag(false);
    }
  }, [autoMatchFlag, excelHeaders, tableFields, handleAutoMatch]);

  const handleClearMapping = React.useCallback(() => {
    setFieldMapping({});
    setCustomValues({});
    message.success('已清空字段映射');
  }, [message]);

  const handleExecute = React.useCallback(
    (confirm: any) => {
      confirm({
        title: '确认导入',
        content: '导入在事务中执行，任一行失败则整批回滚。关联字段通过主键ID匹配，匹配失败则整批回滚。',
        onOk: async () => {
          try {
            await client.request({
              url: 'sjgl02Import:execute',
              method: 'post',
              data: {
                tableName: selectedTable?.name,
                fileId: uploadedFileId,
                sheetName,
                headerRow,
                fieldMapping,
                customValues,
                importMode,
                uniqueFields,
                blankCellMode,
                permSource: permSource || null,
              },
            });
            message.success('导入任务已提交，可在任务管理中查看进度');
            setStep(0);
            setSelectedTable(null);
            resetFileState();
          } catch {
            message.error('提交失败');
          }
        },
      });
    },
    [
      client,
      message,
      selectedTable,
      uploadedFileId,
      sheetName,
      headerRow,
      fieldMapping,
      customValues,
      importMode,
      uniqueFields,
      blankCellMode,
      permSource,
      resetFileState,
    ],
  );

  return {
    step,
    setStep,
    selectedTable,
    setSelectedTable,
    importMode,
    setImportMode,
    allowedModes,
    uploadedFileId,
    setUploadedFileId,
    uploadedFileName,
    setUploadedFileName,
    tableFields,
    previewData,
    setPreviewData,
    uniqueFields,
    setUniqueFields,
    fieldMapping,
    setFieldMapping,
    customValues,
    setCustomValues,
    excelHeaders,
    setExcelHeaders,
    sheetName,
    setSheetName,
    headerRow,
    setHeaderRow,
    availSheets,
    setAvailSheets,
    previewModal,
    setPreviewModal,
    blankCellMode,
    setBlankCellMode,
    isAdminOrRoot,
    permSource,
    permSourceOptions,
    previewMeta,
    setPreviewMeta,
    tables,
    loading,
    permUniqueFields,
    permRequiredFields,
    permImportFields,
    matchInfo,
    resetFileState,
    handlePermSourceChange,
    handleFileSelect,
    handlePreview,
    handleAutoMatch,
    handleClearMapping,
    handleExecute,
  };
}
