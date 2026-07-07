import React from 'react';
import { Steps, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';
import { useImportPanel } from './import-hooks/useImportPanel';
import ImportStepSelectTable from './import-steps/ImportStepSelectTable';
import ImportStepUpload from './import-steps/ImportStepUpload';
import ImportStepPreview from './import-steps/ImportStepPreview';
import { useAPI } from '../utils/api';

export default function ImportPanel() {
  const client = useAPI();
  const { message, modal } = App.useApp();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const state = useImportPanel(message);

  return (
    <div>
      <Steps
        current={state.step}
        items={[
          { title: t('Select target table') },
          { title: t('Upload file & field mapping') },
          { title: t('Preview & execute') },
        ]}
        style={{ marginBottom: 24 }}
      />
      {state.step === 0 && (
        <ImportStepSelectTable
          loading={state.loading}
          tables={state.tables}
          selectedTable={state.selectedTable}
          onSelect={state.setSelectedTable}
          onNext={() => state.setStep(1)}
        />
      )}
      {state.step === 1 && (
        <ImportStepUpload
          client={client}
          message={message}
          selectedTable={state.selectedTable}
          isAdminOrRoot={state.isAdminOrRoot}
          permSource={state.permSource}
          permSourceOptions={state.permSourceOptions}
          allowedModes={state.allowedModes}
          importMode={state.importMode}
          uploadedFileId={state.uploadedFileId}
          uploadedFileName={state.uploadedFileName}
          previewMeta={state.previewMeta}
          sheetName={state.sheetName}
          headerRow={state.headerRow}
          availSheets={state.availSheets}
          excelHeaders={state.excelHeaders}
          tableFields={state.tableFields}
          uniqueFields={state.uniqueFields}
          permUniqueFields={state.permUniqueFields}
          permRequiredFields={state.permRequiredFields}
          permImportFields={state.permImportFields}
          fieldMapping={state.fieldMapping}
          customValues={state.customValues}
          blankCellMode={state.blankCellMode}
          matchInfo={state.matchInfo}
          previewModal={state.previewModal}
          onImportModeChange={state.setImportMode}
          onPermSourceChange={state.handlePermSourceChange}
          onFileSelect={state.handleFileSelect}
          onSheetNameChange={state.setSheetName}
          onHeaderRowChange={state.setHeaderRow}
          onUniqueFieldsChange={state.setUniqueFields}
          onBlankCellModeChange={state.setBlankCellMode}
          onFieldMappingChange={state.setFieldMapping}
          onCustomValuesChange={state.setCustomValues}
          onAutoMatch={state.handleAutoMatch}
          onClearMapping={state.handleClearMapping}
          onPreviewModalChange={state.setPreviewModal}
          onResetFile={() => {
            state.setUploadedFileId(null);
            state.setUploadedFileName('');
            state.setExcelHeaders([]);
            state.setFieldMapping({});
            if (state.permUniqueFields.length === 0) state.setUniqueFields([]);
          }}
          onPrev={() => state.setStep(0)}
          onNext={async () => {
            await state.handlePreview();
            state.setStep(2);
          }}
        />
      )}
      {state.step === 2 && (
        <ImportStepPreview
          selectedTable={state.selectedTable}
          uploadedFileName={state.uploadedFileName}
          sheetName={state.sheetName}
          headerRow={state.headerRow}
          importMode={state.importMode}
          previewData={state.previewData}
          tableFields={state.tableFields}
          uniqueFields={state.uniqueFields}
          fieldMapping={state.fieldMapping}
          customValues={state.customValues}
          onPrev={() => state.setStep(1)}
          onExecute={() => state.handleExecute(modal.confirm)}
        />
      )}
    </div>
  );
}
