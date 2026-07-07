import { apiRequest } from '../shared';
import type { ImportAction } from './importReducer';

export function doParse(
  client: any,
  {
    uploadedFileId,
    sheetName,
    headerRow,
    permUniqueFields,
    uniqueFields,
  }: {
    uploadedFileId: number | null;
    sheetName: string;
    headerRow: number;
    permUniqueFields: string[];
    uniqueFields: string[];
  },
  dispatch: React.Dispatch<ImportAction>,
) {
  if (!uploadedFileId) return;
  dispatch({ type: 'SET_FIELD_MAPPING', payload: {} });
  dispatch({ type: 'SET_CUSTOM_VALUES', payload: {} });
  dispatch({
    type: 'SET_UNIQUE_FIELDS',
    payload: permUniqueFields.length > 0 ? permUniqueFields : uniqueFields,
  });
  client
    .request({
      url: 'sjgl02Import:uploadParse',
      method: 'post',
      data: { fileId: uploadedFileId, sheetName, headerRow },
    })
    .then((pr: any) => {
      const pd = pr?.data?.data;
      if (pd?.headerColumns) dispatch({ type: 'SET_EXCEL_HEADERS', payload: pd.headerColumns });
      if (pd?.sheets) dispatch({ type: 'SET_AVAIL_SHEETS', payload: pd.sheets });
      dispatch({ type: 'SET_PREVIEW_META', payload: pd });
    })
    .catch(() => {
      dispatch({ type: 'SET_EXCEL_HEADERS', payload: [] });
      dispatch({ type: 'SET_AVAIL_SHEETS', payload: [] });
      dispatch({ type: 'SET_PREVIEW_META', payload: null });
    });
}

export function loadFields(client: any, tableName: string | undefined, dispatch: React.Dispatch<ImportAction>) {
  if (!tableName) return;
  client
    .request({
      url: 'sjgl02Import:tableFields',
      method: 'get',
      params: { tableName },
    })
    .then((res: any) => {
      const fields = res?.data?.data || [];
      dispatch({ type: 'SET_TABLE_FIELDS', payload: Array.isArray(fields) ? fields : [] });
    })
    .catch(() => {});
}

export async function loadPermissions(
  client: any,
  permSource: any,
  tableName: string | undefined,
  dispatch: React.Dispatch<ImportAction>,
) {
  if (!tableName) return;
  const pickMode = (list: string[]) => {
    if (list.includes('upsert')) return 'upsert';
    if (list.includes('update')) return 'update';
    if (list.includes('insert')) return 'insert';
    return 'insert';
  };

  try {
    const userData = await apiRequest(client, 'auth:check');
    const currentUserId = userData?.data?.id || userData?.id;
    const roles = (userData?.roles || userData?.data?.roles || []).map((r: any) => r.name || '');
    if (roles.includes('admin') || roles.includes('root')) {
      if (permSource && permSource.type !== 'admin' && permSource.id) {
        const permData = await apiRequest(client, 'sjgl02Permissions:get', {
          params: { targetType: permSource.type, targetId: permSource.id },
        });
        const perm = (permData?.custom || []).find((p: any) => p.tableName === tableName);
        const modes = perm?.importMode || ['insert', 'update', 'upsert'];
        const modeList = Array.isArray(modes) ? modes : [modes];
        dispatch({
          type: 'SET_ALLOWED_MODES',
          payload: perm?.canImport && perm.importMode ? modeList : ['insert', 'update', 'upsert'],
        });
        dispatch({ type: 'SET_IMPORT_MODE', payload: pickMode(modeList) });
        dispatch({
          type: 'SET_PERM_FIELDS',
          payload: {
            unique: perm?.uniqueFields || [],
            required: perm?.requiredFields || [],
            importFields: perm?.importFields || [],
          },
        });
        if (perm?.uniqueFields?.length > 0) {
          dispatch({ type: 'SET_UNIQUE_FIELDS', payload: perm.uniqueFields });
        }
      } else {
        dispatch({ type: 'SET_ALLOWED_MODES', payload: ['insert', 'update', 'upsert'] });
        dispatch({ type: 'SET_IMPORT_MODE', payload: 'upsert' });
        dispatch({ type: 'SET_PERM_FIELDS', payload: { unique: [], required: [], importFields: [] } });
      }
      return;
    }
    if (!currentUserId) {
      dispatch({ type: 'SET_ALLOWED_MODES', payload: ['insert', 'update', 'upsert'] });
      return;
    }
    const permData = await apiRequest(client, 'sjgl02Permissions:get', {
      params: { targetType: 'user', targetId: String(currentUserId) },
    });
    const userPerm = (permData?.custom || []).find((p: any) => p.tableName === tableName);
    const rolePerm = (permData?.inherited || []).find((p: any) => p.tableName === tableName && p.canImport);
    const effectivePerm = userPerm || rolePerm;
    if (userPerm) {
      if (userPerm.canImport && userPerm.importMode) {
        dispatch({
          type: 'SET_ALLOWED_MODES',
          payload: Array.isArray(userPerm.importMode) ? userPerm.importMode : [userPerm.importMode],
        });
      } else {
        dispatch({ type: 'SET_ALLOWED_MODES', payload: [] });
      }
    } else if (rolePerm) {
      const modes = rolePerm.importMode;
      dispatch({
        type: 'SET_ALLOWED_MODES',
        payload: Array.isArray(modes) && modes.length > 0 ? modes : ['insert', 'update', 'upsert'],
      });
    } else {
      dispatch({ type: 'SET_ALLOWED_MODES', payload: ['insert', 'update', 'upsert'] });
    }
    const modes = userPerm?.importMode || rolePerm?.importMode || ['insert', 'update', 'upsert'];
    const modeList = Array.isArray(modes) ? modes : [modes];
    dispatch({ type: 'SET_IMPORT_MODE', payload: pickMode(modeList) });
    if (effectivePerm) {
      dispatch({
        type: 'SET_PERM_FIELDS',
        payload: {
          unique: effectivePerm.uniqueFields || [],
          required: effectivePerm.requiredFields || [],
          importFields: effectivePerm.importFields || [],
        },
      });
      if (effectivePerm.uniqueFields?.length > 0) {
        dispatch({ type: 'SET_UNIQUE_FIELDS', payload: effectivePerm.uniqueFields });
      }
    } else {
      dispatch({ type: 'SET_PERM_FIELDS', payload: { unique: [], required: [], importFields: [] } });
    }
  } catch {
    dispatch({ type: 'SET_ALLOWED_MODES', payload: ['insert', 'update', 'upsert'] });
  }
}

export function handleAutoMatch(
  {
    excelHeaders,
    tableFields,
    permImportFields,
    permRequiredFields,
    permUniqueFields,
  }: {
    excelHeaders: string[];
    tableFields: any[];
    permImportFields: string[];
    permRequiredFields: string[];
    permUniqueFields: string[];
  },
  dispatch: React.Dispatch<ImportAction>,
  t: (key: string, options?: any) => string,
) {
  const mapping: Record<string, string> = {};
  const allowedSet = permImportFields.length > 0 ? new Set(permImportFields) : null;
  let matched = 0;
  let unmatched = 0;
  tableFields.forEach((f: any) => {
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
  dispatch({ type: 'SET_FIELD_MAPPING', payload: mapping });
  dispatch({ type: 'SET_MATCH_INFO', payload: t('Match result', { matched, unmatched }) });
}

export function handleFileSelectAction(
  info: any,
  client: any,
  message: any,
  permUniqueFields: string[],
  dispatch: React.Dispatch<ImportAction>,
  t: (key: string, options?: any) => string,
) {
  if (info.file.status === 'done') {
    const resp = info.file.response;
    const fileId = resp?.id;
    if (fileId) {
      dispatch({ type: 'SET_UPLOADED_FILE', payload: { id: fileId, name: info.file.name } });
      message.success(t('File uploaded successfully', { name: info.file.name }));
      client
        .request({
          url: 'sjgl02Import:uploadParse',
          method: 'post',
          data: { fileId },
        })
        .then((pr: any) => {
          const pd = pr?.data?.data;
          if (pd?.headerColumns) {
            dispatch({ type: 'SET_EXCEL_HEADERS', payload: pd.headerColumns });
            dispatch({ type: 'SET_AUTO_MATCH_FLAG', payload: true });
          }
          if (pd?.sheets) {
            dispatch({ type: 'SET_AVAIL_SHEETS', payload: pd.sheets });
            if (pd.sheets[0]) dispatch({ type: 'SET_SHEET_NAME', payload: pd.sheets[0] });
          }
          dispatch({ type: 'SET_PREVIEW_META', payload: pd });
          if (permUniqueFields.length > 0) {
            dispatch({ type: 'SET_UNIQUE_FIELDS', payload: permUniqueFields });
          }
        })
        .catch(() => {
          dispatch({ type: 'SET_EXCEL_HEADERS', payload: [] });
          dispatch({ type: 'SET_AVAIL_SHEETS', payload: ['Sheet1'] });
          dispatch({ type: 'SET_PREVIEW_META', payload: null });
        });
    } else {
      message.error(t('File ID not found in upload response'));
    }
  } else if (info.file.status === 'error') {
    message.error(t('Upload failed, please retry'));
  }
}
