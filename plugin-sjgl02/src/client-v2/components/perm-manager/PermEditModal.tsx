import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Collapse, InputNumber, Modal, Select, Switch, Tag } from 'antd';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { CollectionMeta, PermRecord, useApi } from '../../services/api';
import { PermTarget } from './TargetSidebar';

const MODE_OPTIONS = [
  { value: 'insert', label: '新增(insert)' },
  { value: 'update', label: '更新(update)' },
  { value: 'upsert', label: '新增+更新(upsert)' },
];

function ChipsSelect({
  options, value, onChange, color, placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  color: string;
  placeholder: string;
}) {
  const remaining = options.filter((o) => !value.includes(o.value));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, border: '1px solid #d9d9d9', borderRadius: 6, minHeight: 36, alignItems: 'center' }}>
      {value.map((v) => (
        <Tag key={v} color={color} closable onClose={() => onChange(value.filter((x) => x !== v))}>
          {options.find((o) => o.value === v)?.label || v}
        </Tag>
      ))}
      <Select size="small" style={{ minWidth: 120 }} placeholder={placeholder} value={null}
        onChange={(v) => onChange([...value, v])} options={remaining}
        showSearch optionFilterProp="label"
        filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
      />
    </div>
  );
}

function SortableRow({
  id, index, label, total, onRemove, onMove,
}: {
  id: string; index: number; label: string; total: number;
  onRemove: () => void; onMove: (dir: 'up' | 'down') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
    background: isDragging ? '#e6f4ff' : '#fafafa', borderRadius: 4,
    border: '1px solid #f0f0f0', marginBottom: 4, cursor: 'default',
  };
  const commitMove = (target: number) => {
    const clamped = Math.max(1, Math.min(target, total));
    if (clamped !== index + 1) onMove(clamped > index + 1 ? 'down' : 'up');
    const diff = clamped - (index + 1);
    if (diff !== 0) {
      const newIndex = clamped - 1;
      // 直接调用 onMove 不够精确，需要通过外部 arrayMove
      // 这里用自定义事件通知父组件
      const event = new CustomEvent('sjgl02-row-move', { detail: { from: index, to: newIndex } });
      window.dispatchEvent(event);
    }
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#999', flexShrink: 0 }}>
        <HolderOutlined />
      </span>
      {editIndex !== null ? (
        <InputNumber size="small" min={1} max={total} value={editIndex} style={{ width: 48 }}
          autoFocus onChange={(v) => setEditIndex(v ?? 1)}
          onPressEnter={() => { commitMove(editIndex); setEditIndex(null); }}
          onBlur={() => { commitMove(editIndex); setEditIndex(null); }}
        />
      ) : (
        <span style={{ width: 24, textAlign: 'center', color: '#999', fontSize: 12, flexShrink: 0, cursor: 'pointer' }}
          onClick={() => setEditIndex(index + 1)}>
          {index + 1}
        </span>
      )}
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <Button type="text" size="small" disabled={index === 0} onClick={() => onMove('up')} style={{ padding: '0 4px', fontSize: 12 }}>↑</Button>
      <Button type="text" size="small" disabled={index === total - 1} onClick={() => onMove('down')} style={{ padding: '0 4px', fontSize: 12 }}>↓</Button>
      <Button type="text" size="small" danger onClick={onRemove} style={{ padding: '0 4px', fontSize: 12 }}>×</Button>
    </div>
  );
}

function SortableFieldList({
  options, value, onChange, placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const t = useT();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const remaining = options.filter((o) => !value.includes(o.value));
  const allSelected = value.length === options.length && options.length > 0;
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label || v;

  const handleDragEnd = (e: { active: { id: string | number }; over: { id: string | number } | null }) => {
    if (e.over && e.active.id !== e.over.id) {
      const oldIndex = value.indexOf(String(e.active.id));
      const newIndex = value.indexOf(String(e.over.id));
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };
  const move = (index: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < value.length) onChange(arrayMove(value, index, target));
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const { from, to } = (e as CustomEvent).detail;
      if (from !== to) onChange(arrayMove(value, from, to));
    };
    window.addEventListener('sjgl02-row-move', handler);
    return () => window.removeEventListener('sjgl02-row-move', handler);
  }, [value, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 8, minHeight: 36 }}>
        {value.length === 0 && (
          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>{t('未选择字段')}</div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={value} strategy={verticalListSortingStrategy}>
            {value.map((v, i) => (
              <SortableRow key={v} id={v} index={i} label={labelOf(v)} total={value.length}
                onRemove={() => onChange(value.filter((x) => x !== v))}
                onMove={(dir) => move(i, dir)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {remaining.length > 0 && (
          <Select size="small" style={{ minWidth: 160, marginTop: 4 }} placeholder={placeholder} value={null}
            onChange={(v) => onChange([...value, v])} options={remaining}
            showSearch optionFilterProp="label"
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          />
        )}
      </div>
    </div>
  );
}

function FieldBlock({
  title, required, children, defaultOpen = true, extra,
}: {
  title: string; required?: boolean; children: React.ReactNode; defaultOpen?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <Collapse ghost defaultActiveKey={defaultOpen ? ['1'] : []} size="small" style={{ marginBottom: 4 }}
      items={[{
        key: '1',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>{title}{required && <span style={{ color: '#ff4d4f' }}> *</span>}</span>
            <span onClick={(e) => e.stopPropagation()}>{extra}</span>
          </div>
        ),
        children,
      }]}
    />
  );
}

interface PermListByCollectionItem {
  id: number;
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  importFields: string[];
  exportFields: string[];
}

function CopyFromConfigModal({
  open, collectionName, fieldOptions, onClose, onCopy,
}: {
  open: boolean;
  collectionName: string;
  fieldOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onCopy: (fields: string[]) => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [list, setList] = useState<PermListByCollectionItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && collectionName) {
      setLoading(true);
      api.permListByCollection(collectionName).then((res) => {
        setList(res.list);
      }).catch(() => setList([])).finally(() => setLoading(false));
    }
  }, [open, collectionName, api]);

  const selected = list.find((x) => x.id === selectedId);
  const validFields = (fields: string[]) => fields.filter((f) => fieldOptions.some((o) => o.value === f));
  const labelOf = (v: string) => fieldOptions.find((o) => o.value === v)?.label || v;

  const handleCopy = () => {
    if (!selected) return;
    const source = selected.importFields.length ? selected.importFields : selected.exportFields;
    const valid = validFields(source);
    if (!valid.length) {
      message.warning(t('该配置中没有当前表可用的字段'));
      return;
    }
    onCopy(valid);
    onClose();
  };

  return (
    <Modal title={`📋 ${t('从其他配置复制')}`} open={open} width={560} onCancel={onClose}
      footer={<><Button onClick={onClose}>{t('取消')}</Button><Button type="primary" disabled={!selectedId} onClick={handleCopy}>{t('确认复制')}</Button></>}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('选择源配置')}</div>
        <Select style={{ width: '100%' }} loading={loading} placeholder={t('选择其他用户/角色的权限配置')}
          value={selectedId} onChange={setSelectedId}
          options={list.map((x) => ({
            value: x.id,
            label: `${x.targetType === 'user' ? '👤' : '🔐'} ${x.targetName}（导入${x.importFields.length}字段/导出${x.exportFields.length}字段）`,
          }))}
          showSearch optionFilterProp="label"
        />
      </div>
      {selected && (
        <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
            {selected.targetType === 'user' ? '👤' : '🔐'} {selected.targetName}
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <strong>导入字段（{validFields(selected.importFields).length}/{selected.importFields.length}）：</strong>
            {validFields(selected.importFields).length ? validFields(selected.importFields).map(labelOf).join('、') : t('无')}
          </div>
          <div style={{ fontSize: 12 }}>
            <strong>导出字段（{validFields(selected.exportFields).length}/{selected.exportFields.length}）：</strong>
            {validFields(selected.exportFields).length ? validFields(selected.exportFields).map(labelOf).join('、') : t('无')}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
        ℹ️ {t('仅显示有当前表权限配置的用户/角色，源字段在当前表不存在的将自动跳过')}
      </div>
    </Modal>
  );
}

export default function PermEditModal({
  target, record, existingCollections = [], onClose, onSaved,
}: {
  target: PermTarget; record?: PermRecord | null; existingCollections?: string[];
  onClose: () => void; onSaved: () => void;
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
  const [importFields, setImportFields] = useState<string[]>(record?.importFields || []);
  const [exportFields, setExportFields] = useState<string[]>(record?.exportFields || []);
  const [meta, setMeta] = useState<CollectionMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [copyModalTarget, setCopyModalTarget] = useState<'import' | 'export' | null>(null);

  useEffect(() => {
    api.getImportableCollections().then((res) => setCollections(res.collections));
  }, [api]);

  useEffect(() => {
    if (collectionName) {
      api.getCollectionMeta(collectionName).then(setMeta);
    } else {
      setMeta(null);
    }
  }, [collectionName, api]);

  const fieldOptions = useMemo(
    () => (meta?.fields || []).filter((f) => !f.ignored).map((f) => ({ value: f.name, label: `${f.title}(${f.name})` })),
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

  const toolbarButtons = (opts: typeof fieldOptions, val: string[], setter: (v: string[]) => void, copyFrom?: { label: string; source: string[] }, copyFromConfig?: boolean) => (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {opts.length > 0 && (
        <>
          <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
            disabled={val.length === opts.length && opts.length > 0}
            onClick={() => setter(opts.map((o) => o.value))}>{t('全选')}</Button>
          <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
            disabled={val.length === 0} onClick={() => setter([])}>{t('清空')}</Button>
        </>
      )}
      {copyFrom && (
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
          disabled={!copyFrom.source.length}
          onClick={() => doCopy(copyFrom.source, copyFrom!.label.includes('导入') ? 'export' : 'import')}>
          {copyFrom.label}
        </Button>
      )}
      {copyFromConfig && (
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
          onClick={() => setCopyModalTarget(copyFromConfig === true ? 'import' : 'export')}>
          📋 {t('从其他配置复制')}
        </Button>
      )}
    </span>
  );

  const save = async () => {
    if (!collectionName) { message.warning(t('请选择数据表')); return; }
    if (canImport && !importModes.length) { message.warning(t('导入模式至少选 1 个')); return; }
    if (canImport && hasUpMode && !uniqueFields.length) { message.warning(t('唯一值字段（update/upsert 必填）至少选 1 个')); return; }
    setSaving(true);
    try {
      const collection = collections.find((c) => c.name === collectionName);
      const values = {
        targetType: target.type, targetId: target.id, targetName: target.name,
        collectionName, collectionTitle: collection?.title || collectionName,
        canImport, canExport,
        importModes: canImport ? importModes : [],
        uniqueFields: canImport ? uniqueFields : [],
        requiredFields: canImport ? requiredFields : [],
        importFields: canImport ? importFields : [],
        exportFields: canExport ? exportFields : [],
      };
      if (record?.id) { await api.updatePermission(record.id, values); } else { await api.createPermission(values); }
      message.success(t('✅ 权限已保存！'));
      onSaved();
    } catch (error) { message.error(String(error)); } finally { setSaving(false); }
  };

  return (
    <Modal title={record ? `✏️ ${t('编辑权限')} · ${record.collectionTitle || record.collectionName}` : `✏️ ${t('新增权限')}`}
      open width={720} onCancel={onClose}
      footer={<><Button onClick={onClose}>{t('取消')}</Button><Button type="primary" loading={saving} onClick={save}>{t('保存配置')}</Button></>}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('选择数据表')} <span style={{ color: '#ff4d4f' }}>*</span></div>
        <Select style={{ width: '100%' }} placeholder={t('- 请选择数据表 -')} value={collectionName || undefined}
          disabled={!!record} onChange={setCollectionName} showSearch optionFilterProp="label"
          options={collections.filter((c) => !!record || !existingCollections.includes(c.name)).map((c) => ({ value: c.name, label: `${c.title}(${c.name})` }))}
        />
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
        <div style={{ border: '1px solid #e6f4ff', borderLeft: '3px solid #1677ff', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fafffe' }}>
          <div style={{ fontWeight: 600, color: '#1677ff', fontSize: 13, marginBottom: 8 }}>⬇ {t('导入配置')}</div>
          <FieldBlock title={`${t('导入模式')}（${t('可多选')}）`} required>
            <ChipsSelect options={MODE_OPTIONS} value={importModes} onChange={setImportModes} color="blue" placeholder={t('+ 添加模式')} />
          </FieldBlock>
          {hasUpMode && (
            <FieldBlock title={`${t('唯一值字段')}（update/upsert ${t('必填')}）`} required>
              <ChipsSelect options={fieldOptions} value={uniqueFields} onChange={setUniqueFields} color="orange" placeholder={t('+ 添加字段')} />
            </FieldBlock>
          )}
          <FieldBlock title={t('必填字段')}>
            <ChipsSelect options={fieldOptions} value={requiredFields} onChange={setRequiredFields} color="red" placeholder={t('+ 添加字段')} />
          </FieldBlock>
          <FieldBlock title={`${t('可导入字段')}（${t('空=全部允许')}）`}
            extra={toolbarButtons(fieldOptions, importFields, setImportFields,
              canExport ? { label: `📋 ${t('复制导出字段')}`, source: exportFields } : undefined, true)}
          >
            <SortableFieldList options={fieldOptions} value={importFields} onChange={setImportFields} placeholder={t('+ 添加字段')} />
          </FieldBlock>
        </div>
      )}

      {canExport && (
        <div style={{ border: '1px solid #f6ffed', borderLeft: '3px solid #52c41a', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#52c41a', fontSize: 13, marginBottom: 8 }}>⬆ {t('导出配置')}</div>
          <FieldBlock title={`${t('可导出字段')}（${t('空=全部允许')}）`}
            extra={toolbarButtons(fieldOptions, exportFields, setExportFields,
              canImport ? { label: `📋 ${t('复制导入字段')}`, source: importFields } : undefined, true)}
          >
            <SortableFieldList options={fieldOptions} value={exportFields} onChange={setExportFields} placeholder={t('+ 添加字段')} />
          </FieldBlock>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#999' }}>* {t('开启导入/导出开关后，可配置对应的详细规则')}</div>

      {copyModalTarget && (
        <CopyFromConfigModal open={!!copyModalTarget} collectionName={collectionName} fieldOptions={fieldOptions}
          onClose={() => setCopyModalTarget(null)}
          onCopy={(fields) => {
            if (copyModalTarget === 'import') {
              if (importFields.length) {
                modal.confirm({ title: t('确认覆盖'), content: t('当前已有 {{count}} 个字段，复制将覆盖现有配置。是否继续？', { count: importFields.length }),
                  onOk: () => { setImportFields(fields); message.success(t('已复制 {{count}} 个字段', { count: fields.length })); } });
              } else { setImportFields(fields); message.success(t('已复制 {{count}} 个字段', { count: fields.length })); }
            } else {
              if (exportFields.length) {
                modal.confirm({ title: t('确认覆盖'), content: t('当前已有 {{count}} 个字段，复制将覆盖现有配置。是否继续？', { count: exportFields.length }),
                  onOk: () => { setExportFields(fields); message.success(t('已复制 {{count}} 个字段', { count: fields.length })); } });
              } else { setExportFields(fields); message.success(t('已复制 {{count}} 个字段', { count: fields.length })); }
            }
          }}
        />
      )}
    </Modal>
  );
}
