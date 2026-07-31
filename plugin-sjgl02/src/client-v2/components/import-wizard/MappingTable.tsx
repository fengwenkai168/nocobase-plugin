import React, { useMemo, useState } from 'react';
import { App, Button, Input, Select, Table, Tag } from 'antd';
import { useT } from '../../locale';
import { CollectionMeta, FieldMetaInfo, ImportMappingItem, PermConfigInfo } from '../../services/api';
import FieldConfigPanel, { defaultFieldConfig, isRelationField } from './FieldConfigPanel';
import { fieldLabel } from './field-utils';

const SYSTEM_FIELDS = ['createdAt', 'updatedAt', 'createdById', 'updatedById'];

export interface MappingRow extends ImportMappingItem {
  meta: FieldMetaInfo;
}

export function useImportableFields(meta?: CollectionMeta, permission?: PermConfigInfo): FieldMetaInfo[] {
  return useMemo(() => {
    if (!meta) return [];
    const whitelist = permission?.importFields || [];
    const filtered = meta.fields.filter((f) => {
      if (f.ignored) return false;
      if (whitelist.length && !whitelist.includes(f.name)) return false;
      return true;
    });
    // 白名单非空时按权限配置的字段顺序排列，否则按 meta.fields 原始顺序
    if (whitelist.length) {
      const fieldMap = new Map(filtered.map((f) => [f.name, f]));
      return whitelist.map((name) => fieldMap.get(name)).filter(Boolean) as FieldMetaInfo[];
    }
    return filtered;
  }, [meta, permission]);
}

export function buildInitMapping(fields: FieldMetaInfo[]): ImportMappingItem[] {
  return fields.map((f) => ({ field: f.name, source: 'ignore' as const }));
}

export default function MappingTable({
  meta,
  fields,
  headers,
  mapping,
  requiredFields,
  uniqueFields,
  mode,
  attachmentUploaded,
  attachmentFolders,
  onChange,
}: {
  meta?: CollectionMeta;
  fields: FieldMetaInfo[];
  headers: string[];
  mapping: ImportMappingItem[];
  requiredFields: string[];
  uniqueFields: string[];
  mode: string;
  attachmentUploaded: boolean;
  attachmentFolders: Array<{ name: string; fileCount: number }>;
  onChange: (mapping: ImportMappingItem[]) => void;
}) {
  const t = useT();
  const { message } = App.useApp();
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const usedColumns = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of mapping) {
      if (item.source === 'excel' && item.columnName) map.set(item.columnName, item.field);
    }
    return map;
  }, [mapping]);

  const setItem = (field: string, item: Partial<ImportMappingItem>) => {
    onChange(mapping.map((m) => (m.field === field ? { ...m, ...item } : m)));
  };

  // 归一化：去空格、忽略大小写、全半角括号统一
  const normalize = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[\s]+/g, '')
      .replace(/[（(]/g, '(')
      .replace(/[）)]/g, ')');

  // 三档匹配：100% 完全相等（含「标题(标识)」括号内标识），80% 包含关系，未匹配保持忽略
  const matchColumn = (f: FieldMetaInfo, candidates: string[]): { column: string; rate: 100 | 80 } | null => {
    const title = normalize(f.title);
    const name = normalize(f.name);
    for (const col of candidates) {
      const normCol = normalize(col);
      if (!normCol) continue;
      if (normCol === title || normCol === name) return { column: col, rate: 100 };
      const bracket = normCol.match(/\(([^)]+)\)$/);
      if (bracket && (bracket[1] === name || bracket[1] === title)) return { column: col, rate: 100 };
    }
    for (const col of candidates) {
      const normCol = normalize(col);
      if (normCol.length < 2) continue;
      if (
        (title.length >= 2 && (normCol.includes(title) || title.includes(normCol))) ||
        (name.length >= 2 && normCol.includes(name))
      ) {
        return { column: col, rate: 80 };
      }
    }
    return null;
  };

  const autoMatch = () => {
    const taken = new Set(usedColumns.keys());
    const stats = { r100: 0, r80: 0, unmatched: 0 };
    const next = mapping.map((m) => {
      if (m.source !== 'ignore') return m;
      if (SYSTEM_FIELDS.includes(m.field)) return m;
      const metaInfo = fields.find((f) => f.name === m.field);
      if (!metaInfo) return m;
      const candidates = headers.filter((h) => !taken.has(h));
      const hit = matchColumn(metaInfo, candidates);
      if (!hit) {
        stats.unmatched += 1;
        return m;
      }
      taken.add(hit.column);
      if (hit.rate === 100) stats.r100 += 1;
      else stats.r80 += 1;
      return {
        ...m,
        source: 'excel' as const,
        columnIndex: headers.indexOf(hit.column),
        columnName: hit.column,
        matchRate: hit.rate,
      };
    });
    onChange(next);
    message.success(
      `${t('自动匹配完成')}：100%×${stats.r100} / 80%×${stats.r80} / ${t('未匹配')}×${stats.unmatched}（${t(
        '保持忽略',
      )}）`,
    );
  };

  const clearAll = () => {
    setExpandedField(null);
    onChange(mapping.map((m) => ({ field: m.field, source: 'ignore' as const })));
  };

  const used = mapping.filter((m) => m.source === 'excel').length;

  const findField = (name: string) => fields.find((x) => x.name === name);

  const togglePanel = (field: string) => setExpandedField((prev) => (prev === field ? null : field));

  const renderConfigCell = (item: ImportMappingItem) => {
    const f = findField(item.field);
    if (!f || SYSTEM_FIELDS.includes(f.name)) return <span style={{ color: '#999' }}>-</span>;
    const ignored = item.source === 'ignore';
    if (isRelationField(f)) {
      return (
        <Button size="small" disabled={ignored} onClick={() => togglePanel(f.name)}>
          ⚙️ {t('配置')}
        </Button>
      );
    }
    if (f.attachment) {
      if (!attachmentUploaded) return <span style={{ color: '#999', fontSize: 11 }}>{t('请先上传压缩包')}</span>;
      const folder = item.config?.folder;
      if (!folder) {
        return (
          <Select
            size="small"
            style={{ minWidth: 130 }}
            placeholder={`📁 ${t('选文件夹')}`}
            value={undefined}
            disabled={ignored}
            onChange={(v) => {
              setItem(f.name, { config: { ...defaultFieldConfig(), ...item.config, folder: v } });
              setExpandedField(f.name);
            }}
            options={attachmentFolders.map((fd) => ({ value: fd.name, label: `📁 ${fd.name}（${fd.fileCount}）` }))}
          />
        );
      }
      return (
        <span style={{ whiteSpace: 'nowrap' }}>
          <Button
            size="small"
            disabled={ignored}
            onClick={() => togglePanel(f.name)}
            title={t('从压缩包中选择，可重新选择其他文件夹')}
          >
            📁 {folder}
          </Button>{' '}
          <Button size="small" disabled={ignored} onClick={() => togglePanel(f.name)}>
            ⚙️ {t('配置')}
          </Button>
        </span>
      );
    }
    return <span style={{ color: '#999' }}>-</span>;
  };

  const fieldTypeLabel = (f: FieldMetaInfo) => {
    const typeMap: Record<string, string> = {
      string: t('单行文本'),
      text: t('多行文本'),
      integer: t('整数'),
      bigInt: t('整数'),
      float: t('数字'),
      double: t('数字'),
      decimal: t('数字'),
      boolean: t('布尔'),
      date: t('日期时间'),
      datetimeNoTz: t('日期时间'),
      dateOnly: t('日期'),
      select: t('单选'),
      checkbox: t('多选'),
      belongsTo: t('多对一'),
      hasMany: t('一对多'),
      belongsToMany: t('多对多'),
      hasOne: t('一对一'),
      json: 'JSON',
      jsonb: 'JSON',
    };
    if (f.attachment) return t('附件');
    if (f.interface === 'select' || f.type === 'select') return t('单选');
    if (f.interface === 'multipleSelect') return t('多选');
    return typeMap[f.type] || f.type;
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>
          📊 {t('字段映射')}{' '}
          <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>
            (
            {t('共{{total}}列/已用{{used}}/剩余{{left}}', { total: headers.length, used, left: headers.length - used })}
            )
          </span>
        </strong>
        <span>
          <Button size="small" onClick={clearAll}>
            🗑 {t('清空匹配')}
          </Button>{' '}
          <Button size="small" onClick={autoMatch}>
            ⚡ {t('自动匹配')}
          </Button>
        </span>
      </div>
      <div
        style={{
          background: '#f0f5ff',
          padding: '6px 10px',
          borderRadius: 4,
          fontSize: 12,
          color: '#666',
          marginBottom: 8,
        }}
      >
        💡{' '}
        {t(
          '关联/附件字段可在「配置」列设置空值处理、匹配不到处理和更新模式；附件字段需先在「配置」列选择压缩包内文件夹',
        )}
      </div>
      <Table
        rowKey="field"
        size="small"
        pagination={false}
        dataSource={mapping}
        expandable={{
          expandedRowKeys: expandedField ? [expandedField] : [],
          expandedRowRender: (item: ImportMappingItem) => {
            const f = findField(item.field);
            if (!f) return null;
            return (
              <FieldConfigPanel
                field={f}
                config={{ ...defaultFieldConfig(), ...item.config }}
                mode={mode}
                folders={attachmentFolders}
                onChange={(config) => setItem(item.field, { config })}
              />
            );
          },
          rowExpandable: (item: ImportMappingItem) => item.field === expandedField,
          showExpandColumn: false,
        }}
        columns={[
          {
            title: 'Excel列',
            width: 240,
            render: (_: unknown, item: ImportMappingItem) => (
              <Select
                style={{ width: '100%' }}
                size="small"
                value={
                  item.source === 'excel' ? item.columnName : item.source === 'custom' ? '__custom__' : '__ignore__'
                }
                onChange={(v) => {
                  if (v === '__ignore__') {
                    // 忽略时：清空该字段配置数据并收起配置面板
                    setItem(item.field, {
                      source: 'ignore',
                      columnIndex: undefined,
                      columnName: undefined,
                      value: undefined,
                      config: undefined,
                      matchRate: undefined,
                    });
                    if (expandedField === item.field) setExpandedField(null);
                  } else if (v === '__custom__')
                    setItem(item.field, {
                      source: 'custom',
                      columnIndex: undefined,
                      columnName: undefined,
                      matchRate: undefined,
                    });
                  else {
                    const columnIndex = headers.indexOf(v);
                    setItem(item.field, {
                      source: 'excel',
                      columnName: v,
                      columnIndex,
                      value: undefined,
                      matchRate: undefined,
                    });
                  }
                }}
                options={[
                  { value: '__ignore__', label: `🚫 ${t('未选择（忽略）')}` },
                  ...headers.map((h) => ({
                    value: h,
                    label:
                      usedColumns.has(h) && usedColumns.get(h) !== item.field
                        ? `${h}（已被 ${fieldLabel(usedColumns.get(h)!, fields)} 占用）`
                        : h,
                    disabled: usedColumns.has(h) && usedColumns.get(h) !== item.field,
                  })),
                  { value: '__custom__', label: `✏️ ${t('自定义内容')}` },
                ]}
              />
            ),
          },
          {
            title: t('映射方式'),
            width: 130,
            align: 'center',
            render: (_: unknown, item: ImportMappingItem) => (
              <span style={{ whiteSpace: 'nowrap' }}>
                {item.source === 'excel' ? (
                  <Tag color="blue">Excel列</Tag>
                ) : item.source === 'custom' ? (
                  <Tag color="green">固定值</Tag>
                ) : (
                  <Tag>忽略</Tag>
                )}
                {item.source === 'excel' && item.matchRate && (
                  <Tag color={item.matchRate === 100 ? 'green' : 'orange'}>{item.matchRate}%</Tag>
                )}
              </span>
            ),
          },
          {
            title: '→',
            width: 30,
            render: () => '→',
          },
          {
            title: t('自定义值'),
            width: 140,
            render: (_: unknown, item: ImportMappingItem) =>
              item.source === 'custom' ? (
                <Input
                  size="small"
                  placeholder={t('输入固定值...')}
                  value={item.value}
                  onChange={(e) => setItem(item.field, { value: e.target.value })}
                />
              ) : null,
          },
          {
            title: meta ? `${t('数据表字段')}(${meta.collectionTitle}-${meta.collectionName})` : t('数据表字段'),
            render: (_: unknown, item: ImportMappingItem) => {
              const f = fields.find((x) => x.name === item.field);
              if (!f) return fieldLabel(item.field, fields);
              return (
                <span>
                  {requiredFields.includes(f.name) && <span style={{ color: '#ff4d4f' }}>* </span>}
                  {f.title}({f.name}) <span style={{ color: '#999', fontSize: 11 }}>- {fieldTypeLabel(f)}</span>
                </span>
              );
            },
          },
          {
            title: t('属性标签'),
            width: 200,
            render: (_: unknown, item: ImportMappingItem) => {
              const f = fields.find((x) => x.name === item.field);
              if (!f) return null;
              return (
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {meta?.pk.name === f.name && <Tag color="gold">主键:{f.title}({f.name})</Tag>}
                  {uniqueFields.includes(f.name) && <Tag color="orange">唯一值</Tag>}
                  {requiredFields.includes(f.name) && <Tag color="red">必填</Tag>}
                  {SYSTEM_FIELDS.includes(f.name) && (
                    <>
                      <Tag>系统字段</Tag>
                      {item.source === 'excel' && <Tag color="blue">⬆ Excel优先</Tag>}
                    </>
                  )}
                </span>
              );
            },
          },
          {
            title: t('配置'),
            width: 190,
            render: (_: unknown, item: ImportMappingItem) => renderConfigCell(item),
          },
        ]}
      />
    </>
  );
}
