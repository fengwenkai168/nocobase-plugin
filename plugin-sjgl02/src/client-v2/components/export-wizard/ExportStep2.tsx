import React, { useMemo, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Radio, Select, Space, Switch, Tag } from 'antd';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

import {
  BarChartOutlined,
  BulbOutlined,
  CheckSquareOutlined,
  CopyOutlined,
  FileTextOutlined,
  KeyOutlined,
  SettingOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useT } from '../../locale';
import { useApi } from '../../services/api';
import { ExportWizardState } from './ExportWizard';
import ExportSchemeModal from './ExportSchemeModal';
import ExportAllTablesSection from './ExportAllTablesSection';
import SortableExportRow from './SortableExportRow';
import ExportFilterSection from './ExportFilterSection';
import ExportRelationSection from './ExportRelationSection';
import {
  dateFormatOptions,
  groupExportFields,
  relationFormatOptions,
  DATE_TYPES,
  RELATION_TYPES,
} from './export-options';

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
  const { message } = App.useApp();
  const [schemeOpen, setSchemeOpen] = useState(false);
  const DATE_OPTS = dateFormatOptions(t);
  const REL_OPTS = relationFormatOptions(t);
  const patchDirty = (p: Partial<ExportWizardState>) => {
    patch(p);
    markDirty();
  };

  const groups = useMemo(() => {
    const fields = state.meta?.fields || [];
    const wl = state.permission?.exportFields || [];
    // 白名单非空时按权限配置的字段顺序排列，否则按 meta.fields 原始顺序
    const orderedFields = wl.length
      ? (wl.map((name) => fields.find((f) => f.name === name)).filter(Boolean) as typeof fields)
      : fields;
    return groupExportFields(
      fields,
      orderedFields.map((f) => f.name),
    );
  }, [state.meta, state.permission]);

  const whitelist = state.permission?.exportFields || [];
  const isAllowed = (name: string) => !whitelist.length || whitelist.includes(name);
  const totalFields = groups.regular.length + groups.dates.length + groups.relations.length + groups.attachments.length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
          <ExportAllTablesSection state={state} onChange={patchDirty} />
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
        title={
          <span style={{ color: '#722ed1' }}>
            <KeyOutlined /> {t('权限切换 - 选择本次导出使用的权限配置')}
          </span>
        }
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

      <Card
        size="small"
        title={
          <span>
            <CheckSquareOutlined /> {t('字段选择（仅显示有权限导出的字段）')}
          </span>
        }
        style={{ marginBottom: 12 }}
        extra={
          <Button size="small" onClick={() => setSchemeOpen(true)}>
            <CopyOutlined /> {t('复用其他方案排序')}
          </Button>
        }
      >
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
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 12 }}
              disabled={state.selectedFields.length === 0}
              onClick={() => patchDirty({ selectedFields: [] })}
            >
              {t('清空')}
            </Button>
          </Space>
        </div>

        {(() => {
          // 合并为一组：按 selectedFields 全局顺序渲染所有已选字段，序号=最终导出列顺序
          const allFields = [...groups.regular, ...groups.dates, ...groups.relations, ...groups.attachments];
          const fieldMap = new Map(allFields.map((f) => [f.name, f]));
          const selected = state.selectedFields.map((name) => fieldMap.get(name)).filter(Boolean) as typeof allFields;
          const unselected = allFields.filter((f) => !state.selectedFields.includes(f.name));

          const groupKeyOf = (f: (typeof allFields)[number]): 'regular' | 'dates' | 'relations' | 'attachments' => {
            if (f.attachment) return 'attachments';
            if (DATE_TYPES.includes(f.type)) return 'dates';
            if (RELATION_TYPES.includes(f.type)) return 'relations';
            return 'regular';
          };
          const groupTag = (f: (typeof allFields)[number]) => {
            const key = groupKeyOf(f);
            const meta = {
              regular: { color: 'default', label: t('常规') },
              dates: { color: 'orange', label: t('日期') },
              relations: { color: 'purple', label: t('关联') },
              attachments: { color: 'cyan', label: t('附件') },
            }[key];
            return (
              <Tag color={meta.color} style={{ marginLeft: 6 }}>
                {meta.label}
              </Tag>
            );
          };

          return (
            <div>
              {selected.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => {
                    if (e.over && e.active.id !== e.over.id) {
                      const oldIdx = state.selectedFields.indexOf(String(e.active.id));
                      const newIdx = state.selectedFields.indexOf(String(e.over.id));
                      if (oldIdx >= 0 && newIdx >= 0) {
                        patchDirty({ selectedFields: arrayMove([...state.selectedFields], oldIdx, newIdx) });
                      }
                    }
                  }}
                >
                  <SortableContext items={state.selectedFields} strategy={verticalListSortingStrategy}>
                    {selected.map((f, i) => (
                      <SortableExportRow
                        key={f.name}
                        id={f.name}
                        index={i}
                        label={
                          <span>
                            {f.title}({f.name}){groupTag(f)}
                          </span>
                        }
                        total={selected.length}
                        extra={
                          groupKeyOf(f) === 'dates' ? (
                            <Select
                              size="small"
                              style={{ minWidth: 200 }}
                              value={state.dateFormats[f.name] || state.globalDateFormat}
                              onChange={(v) => patchDirty({ dateFormats: { ...state.dateFormats, [f.name]: v } })}
                              options={DATE_OPTS}
                              showSearch
                              optionFilterProp="label"
                            />
                          ) : groupKeyOf(f) === 'relations' ? (
                            <>
                              <span style={{ color: '#999', fontSize: 11 }}>
                                {'->'} {f.target}
                                {f.multiple ? `（${t('多值')}）` : ''}
                              </span>
                              <Select
                                size="small"
                                style={{ minWidth: 160 }}
                                value={state.relationFormats[f.name] || state.globalRelationFormat}
                                onChange={(v) =>
                                  patchDirty({ relationFormats: { ...state.relationFormats, [f.name]: v } })
                                }
                                options={REL_OPTS}
                                showSearch
                                optionFilterProp="label"
                              />
                            </>
                          ) : null
                        }
                        onRemove={() =>
                          patchDirty({ selectedFields: state.selectedFields.filter((x) => x !== f.name) })
                        }
                        onMove={(dir) => {
                          const target = dir === 'up' ? i - 1 : i + 1;
                          if (target >= 0 && target < selected.length) {
                            patchDirty({ selectedFields: arrayMove([...state.selectedFields], i, target) });
                          }
                        }}
                        onJumpTo={(targetIdx) => {
                          if (targetIdx >= 0 && targetIdx < selected.length && targetIdx !== i) {
                            patchDirty({ selectedFields: arrayMove([...state.selectedFields], i, targetIdx) });
                          }
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#999', fontSize: 12 }}>
                  {t('尚未选择字段')}
                </div>
              )}
              {unselected.length > 0 && (
                <Select
                  size="small"
                  style={{ minWidth: 260, marginTop: 8 }}
                  placeholder={t('+ 添加字段')}
                  value={null}
                  onChange={(v) => patchDirty({ selectedFields: [...state.selectedFields, v] })}
                  options={unselected.map((f) => ({
                    value: f.name,
                    label: (
                      <span>
                        {f.title}({f.name}){groupTag(f)}
                      </span>
                    ),
                  }))}
                  showSearch
                  optionFilterProp="label"
                />
              )}
            </div>
          );
        })()}
      </Card>

      <Card
        size="small"
        title={
          <span>
            <FileTextOutlined /> {t('关联表导出模式')}
          </span>
        }
        style={{ marginBottom: 12 }}
      >
        <ExportRelationSection state={state} onChange={patchDirty} />
      </Card>

      <Card
        size="small"
        title={
          <span>
            <TagsOutlined /> {t('表头格式')}
          </span>
        }
        style={{ marginBottom: 12 }}
      >
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

      <Card
        size="small"
        title={
          <span>
            <BarChartOutlined /> {t('数据范围')}
          </span>
        }
        style={{ marginBottom: 12 }}
      >
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
          <ExportFilterSection state={state} onChange={(filters) => patchDirty({ filters })} />
        )}
      </Card>

      <Card
        size="small"
        title={
          <span>
            <SettingOutlined /> {t('高级选项')}
          </span>
        }
        style={{ marginBottom: 12 }}
      >
        <Space style={{ marginBottom: 8 }}>
          <Switch checked={state.exportAttachment} onChange={(v) => patchDirty({ exportAttachment: v })} />
          <span style={{ fontSize: 13 }}>{t('导出附件（打包为tar.gz下载）')}</span>
        </Space>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          <BulbOutlined /> {t('超过100万行自动分新文件（默认开启，无需设置）')}
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

      <ExportSchemeModal
        open={schemeOpen}
        collectionName={state.collection?.name || ''}
        fields={state.meta?.fields || []}
        selectedFields={state.selectedFields}
        onClose={() => setSchemeOpen(false)}
        onApply={(scheme) => {
          const current = state.selectedFields;
          const ordered = scheme.exportFields.filter((f) => current.includes(f));
          const rest = current.filter((f) => !scheme.exportFields.includes(f));
          const next = [...ordered, ...rest];
          patchDirty({ selectedFields: next });
          message.success(
            `${t('已按方案')}「${scheme.targetName}」${t('重排')} ${next.length} ${t('个字段')}（${t(
              '仅复用顺序',
            )}，${t('未勾选/无权限字段不参与')}）`,
          );
        }}
      />
    </div>
  );
}
