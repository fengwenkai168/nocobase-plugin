import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App, Modal, Steps } from 'antd';
import { useT } from '../../locale';
import { CollectionMeta, CollectionOption, PermConfigInfo, useApi } from '../../services/api';
import ExportStep1 from './ExportStep1';
import ExportStep2 from './ExportStep2';
import ExportStep3 from './ExportStep3';

export const ALL_TABLES = '__all__';

export interface FilterCondition {
  field: string;
  op: '$eq' | '$gt' | '$gte' | '$lt' | '$lte' | '$includes';
  value: string;
}

export interface ExportWizardState {
  collection?: CollectionOption;
  allTables: boolean;
  isAdmin: boolean;
  meta?: CollectionMeta;
  permissions: PermConfigInfo[];
  permission?: PermConfigInfo;
  selectedFields: string[];
  dateFormats: Record<string, string>;
  relationFormats: Record<string, string>;
  relationExportEnabled: boolean;
  relationFields: string[];
  relationExportMode: 'sheet' | 'file';
  headerType: 'titleName' | 'title' | 'name';
  dataRange: 'all' | 'filtered';
  filters: FilterCondition[];
  exportAttachment: boolean;
  globalDateFormat: string;
  globalRelationFormat: string;
  dirty: boolean;
}

export const initialExportState: ExportWizardState = {
  allTables: false,
  isAdmin: false,
  permissions: [],
  selectedFields: [],
  dateFormats: {},
  relationFormats: {},
  relationExportEnabled: false,
  relationFields: [],
  relationExportMode: 'sheet',
  headerType: 'titleName',
  dataRange: 'all',
  filters: [],
  exportAttachment: false,
  globalDateFormat: 'YYYY-MM-DD HH:mm:ss',
  globalRelationFormat: 'display',
  dirty: false,
};

export default function ExportWizard({
  registerDirtyCheck,
}: {
  registerDirtyCheck?: (tabKey: string, fn: () => boolean) => () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ExportWizardState>(initialExportState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const stepRef = useRef(step);
  stepRef.current = step;

  const patch = useCallback((p: Partial<ExportWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);
  const markDirty = useCallback(() => patch({ dirty: true }), [patch]);

  useEffect(() => {
    // 注册一次并随卸载注销，防止旧实例闭包残留
    return registerDirtyCheck?.('export', () => stateRef.current.dirty && stepRef.current === 1);
  }, [registerDirtyCheck]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (stateRef.current.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const goStep = (target: number) => {
    if (state.dirty && step === 1 && target !== 1) {
      Modal.confirm({
        title: t('当前配置未保存'),
        content: t('确认离开？离开后已填写的字段选择、筛选条件等配置将丢失。'),
        onOk: () => {
          patch({ dirty: false });
          setStep(target);
        },
      });
      return;
    }
    setStep(target);
  };

  const reset = () => {
    setState(initialExportState);
    setStep(0);
  };

  const enterStep2 = useCallback(async () => {
    const { collection, allTables } = stateRef.current;
    if (!collection) return;
    if (allTables) {
      setStep(1);
      return;
    }
    const [meta, perms] = await Promise.all([
      api.getCollectionMeta(collection.name),
      api.getExportPermissions(collection.name),
    ]);
    const permission = perms.permissions[0];
    const whitelist = permission?.exportFields || [];
    const selectable = meta.fields.filter((f) => !f.ignored && (!whitelist.length || whitelist.includes(f.name)));
    patch({
      meta,
      permissions: perms.permissions,
      permission,
      selectedFields: selectable.map((f) => f.name),
    });
    setStep(1);
  }, [api, patch]);

  return (
    <div>
      <Steps
        current={step}
        onChange={goStep}
        items={[{ title: t('选择数据表') }, { title: t('选择字段 & 配置') }, { title: t('执行导出') }]}
        style={{ marginBottom: 24, maxWidth: 720 }}
      />
      {step === 0 && <ExportStep1 state={state} patch={patch} onNext={enterStep2} />}
      {step === 1 && (
        <ExportStep2
          state={state}
          patch={patch}
          markDirty={markDirty}
          onPrev={() => goStep(0)}
          onNext={() => {
            patch({ dirty: false });
            setStep(2);
          }}
        />
      )}
      {step === 2 && <ExportStep3 state={state} patch={patch} onPrev={() => setStep(1)} onDone={reset} />}
    </div>
  );
}
