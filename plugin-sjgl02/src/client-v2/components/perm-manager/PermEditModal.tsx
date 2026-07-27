import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Input, Modal, Select, Space, Switch, Table, Tag } from 'antd';
import { useT } from '../../locale';
import { CollectionMeta, FieldMetaInfo, PermRecord, useApi } from '../../services/api';
import { PermTarget } from './TargetSidebar';

const MODE_OPTIONS = [
  { value: 'insert', label: '新增(insert)' },
  { value: 'update', label: '更新(update)' },
  { value: 'upsert', label: '新增+更新(upsert)' },
];

function ChipsSelect({
  options,
  value,
  onChange,
  color,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  color: string;
  placeholder: string;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, border: '1px solid #d9d9d9', borderRadius: 6, minHeight: 36, alignItems: 'center' }}>
      {value.map((v) => (
        <Tag key={v} color={color} closable onClose={() => onChange(value.filter((x) => x !== v))}>
          {options.find((o) => o.value === v)?.label || v}
        </Tag>
      ))}
      <Select
        size="small"
        style={{ minWidth: 120 }}
        placeholder={placeholder}
        value={null}
        onChange={(v) => onChange([...value, v])}
        options={options.filter((o) => !value.includes(o.value))}
      />
    </div>
  );
}

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
  const { message } = App.useApp();
  const [collections, setCollections] = useState<Array<{ name: string; title: string }>>([]);
  const [collectionName, setCollectionName] = useState(record?.collectionName || '');
  const [canImport, setCanImport] = useState(record?.canImport ?? true);
  const [canExport, setCanExport] = useState(record?.canExport ?? false);
  const [importModes, setImportModes] = useState<string[]>(record?.importModes || ['insert']);
  const [uniqueFields, setUniqueFields] = useState<string[]>(record?.uniqueFields || []);
  const [requiredFields, setRequiredFields] = useState<string[]>(record?.requiredFields || []);
  const [importFields, setImportFields] = useState<string[]>(record?.importFields || []);
  const [exportFields, setExportFields] = useState<string[]>(record?.exportFields || []);
  const [meta, setMeta] = useState<CollectionMeta | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getImportableCollections().then((res) => setCollections(res.collections));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (collectionName) {
      api.getCollectionMeta(collectionName).then(setMeta);
    } else {
      setMeta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  const fieldOptions = useMemo(
    () => (meta?.fields || []).filter((f) => !f.ignored).map((f) => ({ value: f.name, label: `${f.title}(${f.name})` })),
    [meta],
  );
  const hasUpMode = importModes.includes('update') || importModes.includes('upsert');

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
        importFields: canImport ? importFields : [],
        exportFields: canExport ? exportFields : [],
      };
      if (record?.id) {
        await api.updatePermission(record.id, values);
      } else {
        await api.createPermission(values);
      }
      message.success(t('✅ 权限已保存！'));
      onSaved();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={record ? `✏️ ${t('编辑权限')} · ${record.collectionTitle || record.collectionName}` : `✏️ ${t('新增权限')}`}
      open
      width={720}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button type="primary" loading={saving} onClick={save}>{t('保存配置')}</Button>
        </>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('选择数据表')} <span style={{ color: '#ff4d4f' }}>*</span></div>
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
        {!record && existingCollections.length > 0 && (
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            {t('已隐藏 {{count}} 张已配置过权限的数据表（每张表只能配置一次）', { count: existingCollections.length })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('允许导入')}</div>
          <Switch checked={canImport} onChange={setCanImport} />
          <span style={{ marginLeft: 8, fontSize: 13, color: canImport ? '#52c41a' : '#999' }}>{canImport ? t('开启') : t('关闭')}</span>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('允许导出')}</div>
          <Switch checked={canExport} onChange={setCanExport} />
          <span style={{ marginLeft: 8, fontSize: 13, color: canExport ? '#52c41a' : '#999' }}>{canExport ? t('开启') : t('关闭')}</span>
        </div>
      </div>

      {canImport && (
        <div style={{ border: '1px solid #e6f4ff', borderLeft: '3px solid #1677ff', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafffe' }}>
          <div style={{ fontWeight: 600, color: '#1677ff', fontSize: 13, marginBottom: 12 }}>⬇ {t('导入配置')}</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('导入模式')}（{t('可多选')}）<span style={{ color: '#ff4d4f' }}>*</span></div>
            <ChipsSelect options={MODE_OPTIONS} value={importModes} onChange={setImportModes} color="blue" placeholder={t('+ 添加模式')} />
          </div>
          {hasUpMode && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('唯一值字段')}（update/upsert {t('必填')}）<span style={{ color: '#ff4d4f' }}>*</span></div>
              <ChipsSelect options={fieldOptions} value={uniqueFields} onChange={setUniqueFields} color="orange" placeholder={t('+ 添加字段')} />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('必填字段')}</div>
            <ChipsSelect options={fieldOptions} value={requiredFields} onChange={setRequiredFields} color="red" placeholder={t('+ 添加字段')} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('可导入字段')}（{t('空=全部允许')}）</div>
            <ChipsSelect options={fieldOptions} value={importFields} onChange={setImportFields} color="blue" placeholder={t('+ 添加字段')} />
          </div>
        </div>
      )}

      {canExport && (
        <div style={{ border: '1px solid #f6ffed', borderLeft: '3px solid #52c41a', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#52c41a', fontSize: 13, marginBottom: 12 }}>⬆ {t('导出配置')}</div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('可导出字段')}（{t('空=全部允许')}）</div>
            <ChipsSelect options={fieldOptions} value={exportFields} onChange={setExportFields} color="green" placeholder={t('+ 添加字段')} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#999' }}>* {t('开启导入/导出开关后，可配置对应的详细规则')}</div>
    </Modal>
  );
}
