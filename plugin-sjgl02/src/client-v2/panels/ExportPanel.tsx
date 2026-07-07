import React from 'react';
import { Steps, App } from 'antd';
import { observer } from '@nocobase/flow-engine';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';
import { useExportPanel } from './export-hooks/useExportPanel';
import ExportStepSelectTable from './export-steps/ExportStepSelectTable';
import ExportStepConfig from './export-steps/ExportStepConfig';
import ExportStepExecute from './export-steps/ExportStepExecute';

export default observer(function ExportPanel() {
  const { message, modal } = App.useApp();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const state = useExportPanel(message);

  return (
    <div>
      <Steps
        current={state.step}
        items={[
          { title: t('Select target table') },
          { title: t('Select fields & config') },
          { title: t('Execute export') },
        ]}
        style={{ marginBottom: 24 }}
      />
      {state.step === 0 && (
        <ExportStepSelectTable
          loading={state.loading}
          tables={state.tables}
          isAdminOrRoot={state.isAdminOrRoot}
          selTable={state.selTable}
          onSelect={state.handleSelectTable}
          onNext={() => state.setStep(1)}
        />
      )}
      {state.step === 1 && (
        <ExportStepConfig
          isAdminOrRoot={state.isAdminOrRoot}
          isAllTables={state.isAllTables}
          selTable={state.selTable}
          permSource={state.permSource}
          permSourceOptions={state.permSourceOptions}
          onPermSourceChange={state.handlePermSourceChange}
          tables={state.tables}
          fields={state.fields}
          selFields={state.selFields}
          setSelFields={state.setSelFields}
          onToggleField={state.toggleField}
          includeAssocSheet={state.includeAssocSheet}
          onIncludeAssocSheetChange={state.setIncludeAssocSheet}
          selectedAssocTables={state.selectedAssocTables}
          onSelectedAssocTablesChange={state.setSelectedAssocTables}
          fileName={state.fileName}
          onFileNameChange={state.setFileName}
          headerStyle={state.headerStyle}
          onHeaderStyleChange={state.setHeaderStyle}
          includeAttachments={state.includeAttachments}
          onIncludeAttachmentsChange={state.setIncludeAttachments}
          onPrev={() => state.setStep(0)}
          onNext={() => state.setStep(2)}
        />
      )}
      {state.step === 2 && (
        <ExportStepExecute
          isAllTables={state.isAllTables}
          selFieldsCount={state.selFields.length}
          estimatedRows={state.estimatedRows}
          fileName={state.fileName}
          includeAttachments={state.includeAttachments}
          onPrev={() => state.setStep(1)}
          onExport={() => state.handleExport(modal.confirm)}
        />
      )}
    </div>
  );
});
