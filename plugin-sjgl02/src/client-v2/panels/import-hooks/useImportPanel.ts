import React from 'react';
import { useAPI } from '../../utils/api';
import { usePermFilteredTables } from '../shared-hooks';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
import type { ImportTableItem } from './importTypes';
import { importReducer, initialState } from './importReducer';
import { doParse, loadFields, loadPermissions, handleAutoMatch, handleFileSelectAction } from './importActions';

export function useImportPanel(message: any) {
  const client = useAPI();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [state, dispatch] = React.useReducer(importReducer, initialState);
  const {
    tables,
    loading,
    isAdminOrRoot,
    permSource,
    permSourceOptions,
    handlePermSourceChange: baseHandlePermSourceChange,
  } = usePermFilteredTables({ permissionType: 'import', message });

  const {
    uploadedFileId,
    sheetName,
    headerRow,
    permUniqueFields,
    uniqueFields,
    autoMatchFlag,
    excelHeaders,
    tableFields,
    permImportFields,
    permRequiredFields,
  } = state;

  React.useEffect(() => {
    doParse(client, { uploadedFileId, sheetName, headerRow, permUniqueFields, uniqueFields }, dispatch);
  }, [client, uploadedFileId, sheetName, headerRow, permUniqueFields, uniqueFields]);

  React.useEffect(() => {
    loadFields(client, state.selectedTable?.name, dispatch);
  }, [state.selectedTable?.name, client]);

  React.useEffect(() => {
    loadPermissions(client, permSource, state.selectedTable?.name, dispatch).catch(() => {});
  }, [client, permSource, state.selectedTable?.name]);

  React.useEffect(() => {
    if (autoMatchFlag && excelHeaders.length > 0 && tableFields.length > 0) {
      handleAutoMatch(
        { excelHeaders, tableFields, permImportFields, permRequiredFields, permUniqueFields },
        dispatch,
        t,
      );
      dispatch({ type: 'SET_AUTO_MATCH_FLAG', payload: false });
    }
  }, [autoMatchFlag, excelHeaders, tableFields, permImportFields, permRequiredFields, permUniqueFields, t]);

  const handlePermSourceChange = React.useCallback(
    (val: string) => {
      baseHandlePermSourceChange(val);
      dispatch({ type: 'SET_FIELD_MAPPING', payload: {} });
      dispatch({ type: 'SET_CUSTOM_VALUES', payload: {} });
    },
    [baseHandlePermSourceChange],
  );

  const resetFileState = React.useCallback(() => {
    dispatch({ type: 'RESET_FILE_STATE' });
  }, []);

  const handlePreview = React.useCallback(async () => {
    if (!state.uploadedFileId) return;
    try {
      const res = await client.request({
        url: 'sjgl02Import:preview',
        method: 'get',
        params: { fileId: state.uploadedFileId, sheetName: state.sheetName, headerRow: state.headerRow },
      });
      dispatch({ type: 'SET_PREVIEW_DATA', payload: res?.data?.data || null });
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.[0]?.message || err?.message || t('Preview failed');
      message.error(msg);
    }
  }, [client, message, state.uploadedFileId, state.sheetName, state.headerRow, t]);

  const handleClearMapping = React.useCallback(() => {
    dispatch({ type: 'SET_FIELD_MAPPING', payload: {} });
    dispatch({ type: 'SET_CUSTOM_VALUES', payload: {} });
    message.success(t('Field mapping cleared'));
  }, [message, t]);

  const handleExecute = React.useCallback(
    (confirm: any) => {
      confirm({
        title: t('Confirm import'),
        content: t('Import transaction content'),
        onOk: async () => {
          try {
            await client.request({
              url: 'sjgl02Import:execute',
              method: 'post',
              data: {
                tableName: state.selectedTable?.name,
                fileId: state.uploadedFileId,
                sheetName: state.sheetName,
                headerRow: state.headerRow,
                fieldMapping: state.fieldMapping,
                customValues: state.customValues,
                importMode: state.importMode,
                uniqueFields: state.uniqueFields,
                blankCellMode: state.blankCellMode,
                permSource: permSource || null,
              },
            });
            message.success(t('Import task submitted'));
            dispatch({ type: 'SET_STEP', payload: 0 });
            dispatch({ type: 'SET_SELECTED_TABLE', payload: null });
            resetFileState();
          } catch {
            message.error(t('Submit failed'));
          }
        },
      });
    },
    [
      client,
      message,
      state.selectedTable,
      state.uploadedFileId,
      state.sheetName,
      state.headerRow,
      state.fieldMapping,
      state.customValues,
      state.importMode,
      state.uniqueFields,
      state.blankCellMode,
      permSource,
      resetFileState,
      t,
    ],
  );

  return {
    step: state.step,
    setStep: (val: number) => dispatch({ type: 'SET_STEP', payload: val }),
    selectedTable: state.selectedTable,
    setSelectedTable: (val: ImportTableItem | null) => dispatch({ type: 'SET_SELECTED_TABLE', payload: val }),
    importMode: state.importMode,
    setImportMode: (val: string) => dispatch({ type: 'SET_IMPORT_MODE', payload: val }),
    allowedModes: state.allowedModes,
    uploadedFileId: state.uploadedFileId,
    setUploadedFileId: (val: number | null) =>
      dispatch({ type: 'SET_UPLOADED_FILE', payload: { id: val, name: state.uploadedFileName } }),
    uploadedFileName: state.uploadedFileName,
    setUploadedFileName: (val: string) =>
      dispatch({ type: 'SET_UPLOADED_FILE', payload: { id: state.uploadedFileId, name: val } }),
    tableFields: state.tableFields,
    previewData: state.previewData,
    setPreviewData: (val: any) => dispatch({ type: 'SET_PREVIEW_DATA', payload: val }),
    uniqueFields: state.uniqueFields,
    setUniqueFields: (val: string[]) => dispatch({ type: 'SET_UNIQUE_FIELDS', payload: val }),
    fieldMapping: state.fieldMapping,
    setFieldMapping: (val: Record<string, string>) => dispatch({ type: 'SET_FIELD_MAPPING', payload: val }),
    customValues: state.customValues,
    setCustomValues: (val: Record<string, string>) => dispatch({ type: 'SET_CUSTOM_VALUES', payload: val }),
    excelHeaders: state.excelHeaders,
    setExcelHeaders: (val: string[]) => dispatch({ type: 'SET_EXCEL_HEADERS', payload: val }),
    sheetName: state.sheetName,
    setSheetName: (val: string) => dispatch({ type: 'SET_SHEET_NAME', payload: val }),
    headerRow: state.headerRow,
    setHeaderRow: (val: number) => dispatch({ type: 'SET_HEADER_ROW', payload: val }),
    availSheets: state.availSheets,
    setAvailSheets: (val: string[]) => dispatch({ type: 'SET_AVAIL_SHEETS', payload: val }),
    previewModal: state.previewModal,
    setPreviewModal: (val: boolean) => dispatch({ type: 'SET_PREVIEW_MODAL', payload: val }),
    blankCellMode: state.blankCellMode,
    setBlankCellMode: (val: string) => dispatch({ type: 'SET_BLANK_CELL_MODE', payload: val }),
    isAdminOrRoot,
    permSource,
    permSourceOptions,
    previewMeta: state.previewMeta,
    setPreviewMeta: (val: any) => dispatch({ type: 'SET_PREVIEW_META', payload: val }),
    tables,
    loading,
    permUniqueFields: state.permUniqueFields,
    permRequiredFields: state.permRequiredFields,
    permImportFields: state.permImportFields,
    matchInfo: state.matchInfo,
    resetFileState,
    handlePermSourceChange,
    handleFileSelect: (info: any) => handleFileSelectAction(info, client, message, state.permUniqueFields, dispatch, t),
    handlePreview,
    handleAutoMatch: () =>
      handleAutoMatch(
        { excelHeaders, tableFields, permImportFields, permRequiredFields, permUniqueFields },
        dispatch,
        t,
      ),
    handleClearMapping,
    handleExecute,
  };
}
