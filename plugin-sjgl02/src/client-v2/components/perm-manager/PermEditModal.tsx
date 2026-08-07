import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Collapse, InputNumber, Modal, Select, Switch, Tag } from 'antd';

import { ArrowDownOutlined, ArrowUpOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { CollectionMeta, PermRecord, useApi } from '../../services/api';
import { PermTarget } from './TargetSidebar';
import { ChipsSelect, FieldBlock, SortableFieldList } from './PermEditWidgets';
import CopyFromConfigModal from './PermCopyFromConfigModal';

const MODE_OPTIONS = [
  { value: 'insert', label: '新增(insert)' },
  { value: 'update', label: '更新(update)' },
  { value: 'upsert', label: '新增+更新(upsert)' },
];

export default function PermEditModal({
  target,
  record,
  existingCollections = [],
  onClose,
  onSaved,
}: {
  target: PermTarget;
  record?: PermRecord | null;
  existingCollections?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message, modal } = App.useApp();
  const [collections, setCollections] = useState<Array<{ name: string; title: string }>>([]);
  const [collectionName, setCollectionName] = useState(record?.collectionName || '');
  const [canImport, setCanImport] = useState(record?.canImport ?? true);
  const [canExport, setCanExport] = useState(record?.canExport ?? false);
  const [importModes, setImportModes] = useState<string[]>(record?.importModes || ['insert']);
  const [uniqueFields, setUniqueFields] = useState<string[]>(record?.uniqueFields || []);
  const [requiredFields, setRequiredFields] = useState<string[]>(record?.requiredFields || []);
  const [importFields, setImportFields] = useState<string[]>((record?.importFields || []).filter(Boolean));
  const [exportFields, setExportFields] = useState<string[]>((record?.exportFields || []).filter(Boolean));
  const [meta, setMeta] = useState<CollectionMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [copyModalTarget, setCopyModalTarget] = useState<'import' | 'export' | null>(null);

  useEffect(() => {
    api
      .getImportableCollections()
      .then((res) => setCollections(res.collections))
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    if (collectionName) {
      api
        .getCollectionMeta(collectionName)
        .then(setMeta)
        .catch(() => {});
    } else {
      setMeta(null);
    }
  }, [collectionName, api]);

  const fieldOptions = useMemo(
    () =>
      (meta?.fields || []).filter((f) => !f.ignored).map((f) => ({ value: f.name, label: `${f.title}(${f.name})` })),
    [meta],
  );
  const hasUpMode = importModes.includes('update') || importModes.includes('upsert');

  const doCopy = (source: string[], target: 'import' | 'export') => {
    const setter = target === 'import' ? setImportFields : setExportFields;
    const current = target === 'import' ? importFields : exportFields;
    const doIt = () => {
      const valid = source.filter((f) => fieldOptions.some((o) => o.value === f));
      setter(valid);
      message.success(t('已复制 {{count}} 个字段', { count: valid.length }));
    };
    if (current.length) {
      modal.confirm({
        title: t('确认覆盖'),
        content: t('当前已有 {{count}} 个字段，复制将覆盖现有配置。是否继续？', { count: current.length }),
        onOk: doIt,
      });
    } else {
      doIt();
    }
  };

  const toolbarButtons = (
    opts: typeof fieldOptions,
    val: string[],
    setter: (v: string[]) => void,
    copyFrom?: { label: React.ReactNode; source: string[]; direction: 'import' | 'export' },
    copyFromConfig?: 'import' | 'export',
  ) => (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {opts.length > 0 && (
        <>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: 12 }}
            disabled={val.length === opts.length && opts.length > 0}
            onClick={() => setter(opts.map((o) => o.value))}
          >
            {t('全选')}
          </Button>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: 12 }}
            disabled={val.length === 0}
            onClick={() => setter([])}
          >
            {t('清空')}
          </Button>
        </>
      )}
      {copyFrom && (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontSize: 12 }}
          disabled={!copyFrom.source.length}
          onClick={() => doCopy(copyFrom.source, copyFrom.direction === 'import' ? 'export' : 'import')}
        >
          {copyFrom.label}
        </Button>
      )}
      {copyFromConfig && (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontSize: 12 }}
          onClick={() => setCopyModalTarget(copyFromConfig)}
        >
          <FileTextOutlined /> {t('从其他配置复制')}
        </Button>
      )}
    </span>
  );

  const save = async () => {
    if (!collectionName) {
      message.warning(t('请选择数据表'));
      return;
    }
    if (canImport && !importModes.length) {
      message.warning(t('导入模式至少选 1 个'));
      return;
    }
    if (canImport && hasUpMode && !uniqueFields.length) {
      message.warning(t('唯一值字段（update/upsert 必填）至少选 1 个'));
      return;
    }
    setSaving(true);
    try {
      const collection = collections.find((c) => c.name === collectionName);
      const values = {
        targetType: target.type,
        targetId: target.id,
        targetName: target.name,
        collectionName,
        collectionTitle: collection?.title || collectionName,
        canImport,
        canExport,
        importModes: canImport ? importModes : [],
        uniqueFields: canImport ? uniqueFields : [],
        requiredFields: canImport ? requiredFields : [],
        importFields: canImport ? importFields.filter(Boolean) : [],
        exportFields: canExport ? exportFields.filter(Boolean) : [],
      };
      if (record?.id) {
        await api.updatePermission(record.id, values);
      } else {
        await api.createPermission(values);
      }
      message.success(t('权限已保存！'));
      onSaved();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        record ? (
          <span>
            <EditOutlined /> {t('编辑权限')} · {record.collectionTitle || record.collectionName}
          </span>
        ) : (
          <span>
            <EditOutlined /> {t('新增权限')}
          </span>
        )
      }
      open
      width={720}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button type="primary" loading={saving} onClick={save}>
            {t('保存配置')}
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          {t('选择数据表')} <span style={{ color: '#ff4d4f' }}>*</span>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder={t('- 请选择数据表 -')}
          value={collectionName || undefined}
          disabled={!!record}
          onChange={setCollectionName}
          showSearch
          optionFilterProp="label"
          options={collections
            .filter((c) => !!record || !existingCollections.includes(c.name))
            .map((c) => ({ value: c.name, label: `${c.title}(${c.name})` }))}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('允许导入')}</div>
          <Switch checked={canImport} onChange={setCanImport} />
          <span style={{ marginLeft: 8, fontSize: 13, color: canImport ? '#52c41a' : '#999' }}>
            {canImport ? t('开启') : t('关闭')}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('允许导出')}</div>
          <Switch checked={canExport} onChange={setCanExport} />
          <span style={{ marginLeft: 8, fontSize: 13, color: canExport ? '#52c41a' : '#999' }}>
            {canExport ? t('开启') : t('关闭')}
          </span>
        </div>
      </div>

      {!record && !collectionName && (
        <div
          style={{
            padding: '8px 12px',
            background: '#f5f5f5',
            borderRadius: 6,
            fontSize: 12,
            color: '#999',
            marginBottom: 16,
          }}
        >
          {t('请先选择数据表，再配置导入/导出详细规则')}
        </div>
      )}

      {(!record || collectionName) && canImport && (
        <div
          style={{
            border: '1px solid #e6f4ff',
            borderLeft: '3px solid #1677ff',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: '#fafffe',
          }}
        >
          <div style={{ fontWeight: 600, color: '#1677ff', fontSize: 13, marginBottom: 8 }}>
            <ArrowDownOutlined /> {t('导入配置')}
          </div>
          <FieldBlock title={`${t('导入模式')}（${t('可多选')}）`} required>
            <ChipsSelect
              options={MODE_OPTIONS}
              value={importModes}
              onChange={setImportModes}
              color="blue"
              placeholder={t('+ 添加模式')}
            />
          </FieldBlock>
          {hasUpMode && (
            <FieldBlock title={`${t('唯一值字段')}（update/upsert ${t('必填')}）`} required>
              <ChipsSelect
                options={fieldOptions}
                value={uniqueFields}
                onChange={setUniqueFields}
                color="orange"
                placeholder={t('+ 添加字段')}
              />
            </FieldBlock>
          )}
          <FieldBlock title={t('必填字段')}>
            <ChipsSelect
              options={fieldOptions}
              value={requiredFields}
              onChange={setRequiredFields}
              color="red"
              placeholder={t('+ 添加字段')}
            />
          </FieldBlock>
          <FieldBlock
            title={`${t('可导入字段')}（${t('空=全部允许')}）`}
            extra={toolbarButtons(
              fieldOptions,
              importFields,
              setImportFields,
              canExport
                ? {
                    label: (
                      <span>
                        <FileTextOutlined /> {t('复制导出字段')}
                      </span>
                    ),
                    source: exportFields,
                    direction: 'export' as const,
                  }
                : undefined,
              'import',
            )}
          >
            <SortableFieldList
              options={fieldOptions}
              value={importFields}
              onChange={setImportFields}
              placeholder={t('+ 添加字段')}
            />
          </FieldBlock>
        </div>
      )}

      {(!record || collectionName) && canExport && (
        <div
          style={{
            border: '1px solid #f6ffed',
            borderLeft: '3px solid #52c41a',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 600, color: '#52c41a', fontSize: 13, marginBottom: 8 }}>
            <ArrowUpOutlined /> {t('导出配置')}
          </div>
          <FieldBlock
            title={`${t('可导出字段')}（${t('空=全部允许')}）`}
            extra={toolbarButtons(
              fieldOptions,
              exportFields,
              setExportFields,
              canImport
                ? {
                    label: (
                      <span>
                        <FileTextOutlined /> {t('复制导入字段')}
                      </span>
                    ),
                    source: importFields,
                    direction: 'import' as const,
                  }
                : undefined,
              'export',
            )}
          >
            <SortableFieldList
              options={fieldOptions}
              value={exportFields}
              onChange={setExportFields}
              placeholder={t('+ 添加字段')}
            />
          </FieldBlock>
        </div>
      )}

      {record && <div style={{ fontSize: 12, color: '#999' }}>* {t('开启导入/导出开关后，可配置对应的详细规则')}</div>}

      {copyModalTarget && (
        <CopyFromConfigModal
          open={!!copyModalTarget}
          collectionName={collectionName}
          fieldOptions={fieldOptions}
          onClose={() => setCopyModalTarget(null)}
          onCopy={(fields) => {
            if (copyModalTarget === 'import') {
              if (importFields.length) {
                modal.confirm({
                  title: t('确认覆盖'),
                  content: t('当前已有 {{count}} 个字段，复制将覆盖现有配置。是否继续？', {
                    count: importFields.length,
                  }),
                  onOk: () => {
                    setImportFields(fields);
                    message.success(t('已复制 {{count}} 个字段', { count: fields.length }));
                  },
                });
              } else {
                setImportFields(fields);
                message.success(t('已复制 {{count}} 个字段', { count: fields.length }));
              }
            } else {
              if (exportFields.length) {
                modal.confirm({
                  title: t('确认覆盖'),
                  content: t('当前已有 {{count}} 个字段，复制将覆盖现有配置。是否继续？', {
                    count: exportFields.length,
                  }),
                  onOk: () => {
                    setExportFields(fields);
                    message.success(t('已复制 {{count}} 个字段', { count: fields.length }));
                  },
                });
              } else {
                setExportFields(fields);
                message.success(t('已复制 {{count}} 个字段', { count: fields.length }));
              }
            }
          }}
        />
      )}
    </Modal>
  );
}
