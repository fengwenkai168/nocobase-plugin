import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Collapse, Input, InputNumber, Radio, Select, Space, Switch, Tag } from 'antd';
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
import { FieldMetaInfo } from '../../services/api';
import { ExportWizardState, FilterCondition } from './ExportWizard';

const DATE_TYPES = ['date', 'datetimeTz', 'datetimeNoTz', 'dateOnly', 'unixTimestamp'];
const RELATION_TYPES = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'];

function dateFormatOptions(t: (s: string) => string) {
  return [
    { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss（2026-07-09 15:30:00）' },
    { value: 'YYYY/MM/DD HH:mm:ss', label: 'YYYY/MM/DD HH:mm:ss（2026/07/09 15:30:00）' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD（2026-07-09）' },
    { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD（2026/07/09）' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY（09/07/2026）' },
    { value: 'UTC ISO 8601', label: 'UTC ISO 8601（2026-07-09T07:30:00.000Z）' },
    { value: '时间戳(毫秒)', label: `${t('时间戳(毫秒)')}（1752058200000）` },
    { value: '时间戳(秒)', label: `${t('时间戳(秒)')}（1752058200）` },
  ];
}
function relationFormatOptions(t: (s: string) => string) {
  return [
    { value: 'display', label: t('显示值（如: 管理员）') },
    { value: 'pk', label: t('主键值（如: 1/UUID）') },
    { value: 'displayPk', label: t('显示值+主键值（如: 管理员(1)）') },
  ];
}
function opOptions(t: (s: string) => string) {
  return [
    { value: '$eq', label: t('等于') },
    { value: '$gt', label: t('大于') },
    { value: '$gte', label: t('大于等于') },
    { value: '$lt', label: t('小于') },
    { value: '$lte', label: t('小于等于') },
    { value: '$includes', label: t('包含') },
  ];
}

function SortableExportRow({
  id, index, label, total, extra, onRemove, onMove, onJumpTo,
}: {
  id: string; index: number; label: string; total: number;
  extra?: React.ReactNode; onRemove: () => void; onMove: (dir: 'up' | 'down') => void;
  onJumpTo?: (targetIndex: number) => void;
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
    if (clamped !== index + 1 && onJumpTo) {
      onJumpTo(clamped - 1);
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
      {extra}
      <Button type="text" size="small" disabled={index === 0} onClick={() => onMove('up')} style={{ padding: '0 4px', fontSize: 12 }}>↑</Button>
      <Button type="text" size="small" disabled={index === total - 1} onClick={() => onMove('down')} style={{ padding: '0 4px', fontSize: 12 }}>↓</Button>
      <Button type="text" size="small" danger onClick={onRemove} style={{ padding: '0 4px', fontSize: 12 }}>×</Button>
    </div>
  );
}

export default function ExportStep2({
  state,
  patch,
  markDirty,
  onPrev,
  onNext,
}: {
  state: ExportWizardState;
  patch: (p: Partial<ExportWizardState>) => void;
  markDirty: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const DATE_OPTS = dateFormatOptions(t);
  const REL_OPTS = relationFormatOptions(t);
  const OP_OPTS = opOptions(t);
  const patchDirty = (p: Partial<ExportWizardState>) => {
    patch(p);
    markDirty();
  };

  const groups = useMemo(() => {
    const fields = state.meta?.fields || [];
    const wl = state.permission?.exportFields || [];
    // 白名单非空时按权限配置的字段顺序排列，否则按 meta.fields 原始顺序
    const orderedFields = wl.length
      ? wl.map((name) => fields.find((f) => f.name === name)).filter(Boolean) as typeof fields
      : fields;
    return {
      regular: orderedFields.filter(
        (f) => !f.ignored && !DATE_TYPES.includes(f.type) && !RELATION_TYPES.includes(f.type) && !f.attachment,
      ),
      dates: orderedFields.filter((f) => !f.ignored && DATE_TYPES.includes(f.type)),
      relations: orderedFields.filter((f) => !f.ignored && RELATION_TYPES.includes(f.type) && !f.attachment),
      attachments: orderedFields.filter((f) => !f.ignored && f.attachment),
    };
  }, [state.meta, state.permission]);

  const whitelist = state.permission?.exportFields || [];
  const isAllowed = (name: string) => !whitelist.length || whitelist.includes(name);
  const toggleField = (name: string, checked: boolean) => {
    patchDirty({
      selectedFields: checked ? [...state.selectedFields, name] : state.selectedFields.filter((f) => f !== name),
    });
  };
  const totalFields = groups.regular.length + groups.dates.length + groups.relations.length + groups.attachments.length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addFilter = () => {
    const first = state.meta?.fields.find((f) => !RELATION_TYPES.includes(f.type) && !f.attachment);
    patchDirty({ filters: [...state.filters, { field: first?.name || '', op: '$eq', value: '' }] });
  };

  if (state.allTables) {
    return (
      <div>
        <h4 style={{ marginBottom: 12 }}>
          {t('目标表')}：{state.collection?.title}
        </h4>
        <Card size="small" style={{ marginBottom: 16, borderLeft: '3px solid #1677ff' }}>
          <Alert
            type="info"
            showIcon
            message={
              <>
                <strong>{t('将导出全部数据表（含系统表）')}</strong>
                <br />
                <span style={{ fontSize: 12, color: '#666' }}>
                  {t('每张表导出全部字段为独立 xlsx 文件，打包为 tar.gz 下载。无需逐表配置字段和关联。')}
                </span>
              </>
            }
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>📅 {t('日期时间导出格式（全局）')}</div>
              <Select
                style={{ width: '100%' }}
                value={state.globalDateFormat}
                onChange={(v) => patchDirty({ globalDateFormat: v })}
                options={DATE_OPTS}
              />
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                {t('所有表的日期时间字段统一使用此格式导出')}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>🔗 {t('关联值导出格式（全局）')}</div>
              <Select
                style={{ width: '100%' }}
                value={state.globalRelationFormat}
                onChange={(v) => patchDirty({ globalRelationFormat: v })}
                options={REL_OPTS}
              />
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{t('所有表的关联字段统一使用此格式导出')}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
            <Space>
              <Switch checked={state.exportAttachment} onChange={(v) => patchDirty({ exportAttachment: v })} />
              <span style={{ fontSize: 13 }}>📎 {t('导出附件（各表附件文件一并打包进 tar.gz）')}</span>
            </Space>
          </div>
        </Card>
        <div style={{ textAlign: 'right' }}>
          <Button onClick={onPrev}>← {t('上一步')}</Button>{' '}
          <Button type="primary" onClick={onNext}>
            {t('下一步')} →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ marginBottom: 12 }}>
        {t('目标表')}：{state.collection?.title}({state.collection?.name})
      </h4>

      <Card
        size="small"
        title={<span style={{ color: '#722ed1' }}>🔑 {t('权限切换 - 选择本次导出使用的权限配置')}</span>}
        style={{ marginBottom: 12, borderLeft: '3px solid #722ed1' }}
      >
        <Select
          style={{ width: '100%' }}
          value={state.permission?.id ?? '__admin__'}
          onChange={(v) => {
            const permission = state.permissions.find((p) => (p.id ?? '__admin__') === v);
            if (!permission) return;
            const wl = permission.exportFields || [];
            patchDirty({
              permission,
              selectedFields: wl.length ? state.selectedFields.filter((f) => wl.includes(f)) : state.selectedFields,
            });
          }}
          options={state.permissions.map((p) => ({
            value: p.id ?? '__admin__',
            label: `${p.targetType === 'user' ? '👤' : '🔐'} ${p.targetName}（${t('可导出')}: ${
              p.exportFields.length ? `${p.exportFields.length} ${t('个字段')}` : t('全部字段')
            }）`,
          }))}
        />
        <Alert
          style={{ marginTop: 8 }}
          type="info"
          showIcon
          message={t('选中权限后，可导出字段自动锁定。admin/root 可切换全部权限配置，普通用户只能选自己的权限。')}
        />
      </Card>

      <Card size="small" title={`☑️ ${t('字段选择（仅显示有权限导出的字段）')}`} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <Checkbox
              indeterminate={state.selectedFields.length > 0 && state.selectedFields.length < totalFields}
              checked={state.selectedFields.length === totalFields && totalFields > 0}
              onChange={(e) => {
                const all = [...groups.regular, ...groups.dates, ...groups.relations, ...groups.attachments]
                  .filter((f) => isAllowed(f.name))
                  .map((f) => f.name);
                patchDirty({ selectedFields: e.target.checked ? all : [] });
              }}
            >
              {t('全选')}
            </Checkbox>
            <span style={{ color: '#999', marginLeft: 12, fontSize: 12 }}>
              {t('已选')}: {state.selectedFields.length} / {totalFields}
            </span>
          </div>
          <Space size={4}>
            <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
              disabled={state.selectedFields.length === 0}
              onClick={() => patchDirty({ selectedFields: [] })}>{t('清空')}</Button>
          </Space>
        </div>

        {(['regular', 'dates', 'relations', 'attachments'] as const).map((groupKey) => {
          const groupFields = groups[groupKey];
          if (!groupFields.length) return null;
          const selected = groupFields.filter((f) => state.selectedFields.includes(f.name));
          const unselected = groupFields.filter((f) => !state.selectedFields.includes(f.name));
          const groupLabel = groupKey === 'regular' ? `📄 ${t('常规字段')}` : groupKey === 'dates' ? `📅 ${t('日期时间字段')}` : groupKey === 'relations' ? `🔗 ${t('关联字段')}` : `📎 ${t('附件字段')}`;
          const groupColor = groupKey === 'dates' ? '#fa8c16' : groupKey === 'relations' ? '#7c3aed' : groupKey === 'attachments' ? '#0891b2' : undefined;

          return (
            <Collapse
              key={groupKey}
              ghost
              defaultActiveKey={selected.length > 0 ? ['1'] : []}
              size="small"
              style={{ marginBottom: 4 }}
            >
              <Collapse.Panel
                key="1"
                header={<span style={{ fontSize: 12, color: groupColor, fontWeight: 600 }}>{groupLabel} ({selected.length}/{groupFields.length})</span>}
              >
                <div>
                  {selected.length > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter}
                      onDragEnd={(e) => {
                        if (e.over && e.active.id !== e.over.id) {
                          const oldIdx = selected.findIndex((f) => f.name === e.active.id);
                          const newIdx = selected.findIndex((f) => f.name === e.over.id);
                          const allSelected = [...state.selectedFields];
                          const oldAllIdx = allSelected.indexOf(selected[oldIdx].name);
                          const newAllIdx = allSelected.indexOf(selected[newIdx].name);
                          patchDirty({ selectedFields: arrayMove(allSelected, oldAllIdx, newAllIdx) });
                        }
                      }}>
                      <SortableContext items={selected.map((f) => f.name)} strategy={verticalListSortingStrategy}>
                        {selected.map((f, i) => (
                          <SortableExportRow
                            key={f.name} id={f.name} index={i} label={`${f.title}(${f.name})`} total={selected.length}
                            extra={
                              groupKey === 'dates' ? (
                                <Select size="small" style={{ minWidth: 200 }}
                                  value={state.dateFormats[f.name] || state.globalDateFormat}
                                  onChange={(v) => patchDirty({ dateFormats: { ...state.dateFormats, [f.name]: v } })}
                                  options={DATE_OPTS} showSearch optionFilterProp="label" />
                              ) : groupKey === 'relations' ? (
                                <>
                                  <span style={{ color: '#999', fontSize: 11 }}>{'->'} {f.target}{f.multiple ? `（${t('多值')}）` : ''}</span>
                                  <Select size="small" style={{ minWidth: 160 }}
                                    value={state.relationFormats[f.name] || state.globalRelationFormat}
                                    onChange={(v) => patchDirty({ relationFormats: { ...state.relationFormats, [f.name]: v } })}
                                    options={REL_OPTS} showSearch optionFilterProp="label" />
                                </>
                              ) : null
                            }
                            onRemove={() => patchDirty({ selectedFields: state.selectedFields.filter((x) => x !== f.name) })}
                            onMove={(dir) => {
                              const target = dir === 'up' ? i - 1 : i + 1;
                              if (target >= 0 && target < selected.length) {
                                const allSelected = [...state.selectedFields];
                                const oldAllIdx = allSelected.indexOf(f.name);
                                const newAllIdx = allSelected.indexOf(selected[target].name);
                                patchDirty({ selectedFields: arrayMove(allSelected, oldAllIdx, newAllIdx) });
                              }
                            }}
                            onJumpTo={(targetIdx) => {
                              const allSelected = [...state.selectedFields];
                              const oldAllIdx = allSelected.indexOf(f.name);
                              const newAllIdx = allSelected.indexOf(selected[targetIdx].name);
                              if (oldAllIdx >= 0 && newAllIdx >= 0) {
                                patchDirty({ selectedFields: arrayMove(allSelected, oldAllIdx, newAllIdx) });
                              }
                            }}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                  {unselected.length > 0 && (
                    <Select size="small" style={{ minWidth: 200, marginTop: 4 }} placeholder={t('+ 添加字段')} value={null}
                      onChange={(v) => patchDirty({ selectedFields: [...state.selectedFields, v] })}
                      options={unselected.map((f) => ({ value: f.name, label: `${f.title}(${f.name})` }))}
                      showSearch optionFilterProp="label" />
                  )}
                </div>
              </Collapse.Panel>
            </Collapse>
          );
        })}
      </Card>

      <Card size="small" title={`📑 ${t('关联表导出模式')}`} style={{ marginBottom: 12 }}>
        <Space style={{ marginBottom: 12 }}>
          <Switch
            checked={state.relationExportEnabled}
            onChange={(v) => patchDirty({ relationExportEnabled: v, relationFields: v ? state.relationFields : [] })}
          />
          <span style={{ fontSize: 13, color: state.relationExportEnabled ? '#52c41a' : '#999' }}>
            {state.relationExportEnabled ? t('导出关联表') : t('不导出关联表')}
          </span>
        </Space>
        {state.relationExportEnabled ? (
          <>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              {t('选择需要导出关联表数据的关联字段（多选），每个选中的关联表可作为单独Sheet或单独xlsx文件导出')}
            </div>
            <Space wrap style={{ marginBottom: 12 }}>
              {state.relationFields.map((name) => {
                const f = groups.relations.find((x) => x.name === name);
                return (
                  <Tag
                    key={name}
                    color={f?.multiple ? 'purple' : 'blue'}
                    closable
                    onClose={() => patchDirty({ relationFields: state.relationFields.filter((x) => x !== name) })}
                  >
                    {f?.title}({name}) -&gt; {f?.target}
                  </Tag>
                );
              })}
              <Select
                size="small"
                style={{ minWidth: 200 }}
                placeholder={t('+ 添加关联表')}
                value={null}
                onChange={(v) => patchDirty({ relationFields: [...state.relationFields, v] })}
                options={groups.relations
                  .filter((f) => !state.relationFields.includes(f.name))
                  .map((f) => ({ value: f.name, label: `${f.title}(${f.name}) -> ${f.target}` }))}
              />
            </Space>
            <Radio.Group
              value={state.relationExportMode}
              onChange={(e) => patchDirty({ relationExportMode: e.target.value })}
              options={[
                { value: 'sheet', label: t('关联表作为单独Sheet') },
                { value: 'file', label: t('关联表作为单独xlsx文件') },
              ]}
            />
            <div
              style={{
                fontSize: 12,
                color: '#999',
                background: '#f0f5ff',
                padding: '8px 10px',
                borderRadius: 4,
                marginTop: 8,
              }}
            >
              {t(
                '单独Sheet: Sheet命名 -> 主表字段名称(主表字段标识)-关联表名称(关联表标识)，例: 角色(role)-角色(roles)',
              )}
              <br />
              {t('单独xlsx: 各文件独立命名，多个文件打包为tar.gz下载')}
            </div>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            message={
              <>
                <strong>{t('本次导出不包含关联表数据')}</strong>
                {t('。主表导出仅包含当前表字段。')}
              </>
            }
          />
        )}
      </Card>

      <Card size="small" title={`🏷️ ${t('表头格式')}`} style={{ marginBottom: 12 }}>
        <Radio.Group
          value={state.headerType}
          onChange={(e) => patchDirty({ headerType: e.target.value })}
          options={[
            { value: 'titleName', label: `${t('字段名称(字段名)')}（例: 地址(address)）` },
            { value: 'title', label: `${t('字段名称')}（例: 地址）` },
            { value: 'name', label: `${t('字段名')}（例: address）` },
          ]}
        />
      </Card>

      <Card size="small" title={`📊 ${t('数据范围')}`} style={{ marginBottom: 12 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button
            size="small"
            type={state.dataRange === 'all' ? 'primary' : 'default'}
            onClick={() => patchDirty({ dataRange: 'all' })}
          >
            {t('全部数据')}
          </Button>
          <Button
            size="small"
            type={state.dataRange === 'filtered' ? 'primary' : 'default'}
            onClick={() => patchDirty({ dataRange: 'filtered' })}
          >
            {t('自定义条件')}
          </Button>
        </Space>
        {state.dataRange === 'filtered' && (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('筛选条件（AND）')}</div>
            {state.filters.map((filter, idx) => (
              <Space key={idx} style={{ marginBottom: 8 }}>
                <Select
                  size="small"
                  style={{ minWidth: 140 }}
                  value={filter.field}
                  onChange={(v) => {
                    const next = [...state.filters];
                    next[idx] = { ...filter, field: v };
                    patchDirty({ filters: next });
                  }}
                  options={(state.meta?.fields || [])
                    .filter((f) => !RELATION_TYPES.includes(f.type) && !f.attachment)
                    .map((f) => ({ value: f.name, label: f.title }))}
                />
                <Select
                  size="small"
                  style={{ width: 100 }}
                  value={filter.op}
                  onChange={(v) => {
                    const next = [...state.filters];
                    next[idx] = { ...filter, op: v };
                    patchDirty({ filters: next });
                  }}
                  options={OP_OPTS}
                />
                <Input
                  size="small"
                  style={{ width: 140 }}
                  value={filter.value}
                  onChange={(e) => {
                    const next = [...state.filters];
                    next[idx] = { ...filter, value: e.target.value };
                    patchDirty({ filters: next });
                  }}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  onClick={() => patchDirty({ filters: state.filters.filter((_, i) => i !== idx) })}
                >
                  🗑
                </Button>
              </Space>
            ))}
            <div>
              <Button size="small" type="dashed" onClick={addFilter}>
                + {t('添加条件')}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card size="small" title={`⚙️ ${t('高级选项')}`} style={{ marginBottom: 12 }}>
        <Space style={{ marginBottom: 8 }}>
          <Switch checked={state.exportAttachment} onChange={(v) => patchDirty({ exportAttachment: v })} />
          <span style={{ fontSize: 13 }}>{t('导出附件（打包为tar.gz下载）')}</span>
        </Space>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          💡 {t('超过100万行自动分新文件（默认开启，无需设置）')}
        </div>
        <div>
          <span style={{ color: '#999' }}>{t('导出格式')}：</span>
          <strong>xlsx（固定）</strong>
        </div>
      </Card>

      <div style={{ textAlign: 'right' }}>
        <Button onClick={onPrev}>← {t('上一步')}</Button>{' '}
        <Button type="primary" disabled={!state.selectedFields.length} onClick={onNext}>
          {t('下一步')} →
        </Button>
      </div>
    </div>
  );
}
