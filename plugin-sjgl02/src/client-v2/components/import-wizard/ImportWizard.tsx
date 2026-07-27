import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Modal, Steps } from 'antd';
import { useT } from '../../locale';
import {
  CollectionMeta,
  CollectionOption,
  ImportMappingItem,
  PermConfigInfo,
  PreviewResult,
  UploadResult,
  useApi,
} from '../../services/api';
import ImportStep1 from './ImportStep1';
import ImportStep2 from './ImportStep2';
import ImportStep3 from './ImportStep3';

export interface ImportWizardState {
  collection?: CollectionOption;
  upload?: UploadResult;
  sheetName: string;
  headerRow: number;
  permissions: PermConfigInfo[];
  permission?: PermConfigInfo;
  mode: string;
  uniqueFields: string[];
  blankStrategy: 'clear' | 'preserve';
  mapping: ImportMappingItem[];
  attachmentEnabled: boolean;
  attachment?: UploadResult;
  meta?: CollectionMeta;
  preview?: PreviewResult;
  dirty: boolean;
}

export const initialImportState: ImportWizardState = {
  sheetName: '',
  headerRow: 1,
  permissions: [],
  mode: 'insert',
  uniqueFields: [],
  blankStrategy: 'clear',
  mapping: [],
  attachmentEnabled: false,
  dirty: false,
};

export default function ImportWizard({
  registerDirtyCheck,
}: {
  registerDirtyCheck?: (tabKey: string, fn: () => boolean) => () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ImportWizardState>(initialImportState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const stepRef = useRef(step);
  stepRef.current = step;

  const patch = useCallback((p: Partial<ImportWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const markDirty = useCallback(() => patch({ dirty: true }), [patch]);

  useEffect(() => {
    // 注册一次并随卸载注销，防止旧实例闭包残留
    return registerDirtyCheck?.('import', () => stateRef.current.dirty && stepRef.current === 1);
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

  const guardLeave = (target: number, action: () => void) => {
    if (state.dirty && step === 1 && target !== 1) {
      Modal.confirm({
        title: t('当前配置未保存'),
        content: t('确认离开？离开后已填写的字段映射、唯一值、导入模式等配置将丢失。'),
        onOk: () => {
          patch({ dirty: false });
          action();
        },
      });
      return;
    }
    action();
  };

  const goStep = (target: number) => guardLeave(target, () => setStep(target));

  const reset = () => {
    setState(initialImportState);
    setStep(0);
  };

  const loadPreview = useCallback(
    async (upload: UploadResult, sheetName: string, headerRow: number) => {
      const preview = await api.previewExcel({
        filePath: upload.filePath,
        fileKind: upload.fileKind!,
        sheetName,
        headerRow,
      });
      patch({ preview });
      return preview;
    },
    [api, patch],
  );

  const enterStep2 = useCallback(async () => {
    const { collection, upload } = stateRef.current;
    if (!collection || !upload) return;
    const sheetName = upload.sheets?.[0]?.name || 'Sheet1';
    const [meta, perms] = await Promise.all([
      api.getCollectionMeta(collection.name),
      api.getImportPermissions(collection.name),
    ]);
    const permission = perms.permissions[0];
    const mode = permission?.importModes?.[permission.importModes.length - 1] || 'insert';
    const uniqueFields = permission?.uniqueFields?.length ? [...permission.uniqueFields] : [];
    patch({ meta, permissions: perms.permissions, permission, mode, uniqueFields, sheetName, headerRow: 1 });
    await loadPreview(upload, sheetName, 1);
    setStep(1);
  }, [api, loadPreview, patch]);

  return (
    <div>
      <Steps
        current={step}
        onChange={goStep}
        items={[{ title: t('选择数据表 & 上传文件') }, { title: t('配置映射') }, { title: t('预览 & 执行') }]}
        style={{ marginBottom: 24, maxWidth: 720 }}
      />
      {step === 0 && <ImportStep1 state={state} patch={patch} onNext={enterStep2} />}
      {step === 1 && (
        <ImportStep2
          state={state}
          patch={patch}
          markDirty={markDirty}
          reloadPreview={loadPreview}
          onPrev={() => goStep(0)}
          onNext={() => {
            patch({ dirty: false });
            setStep(2);
          }}
        />
      )}
      {step === 2 && <ImportStep3 state={state} patch={patch} onPrev={() => setStep(1)} onDone={reset} />}
    </div>
  );
}
