import React, { useMemo } from 'react';
import { Button, Card, Select, Space, Tag } from 'antd';
import { DeleteOutlined, TagsOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { ExportWizardState } from './ExportWizard';

/** 导出排序配置：最多 3 级（字段 + 升/降序） */
export default function ExportSortSection({
  state,
  onChange,
}: {
  state: ExportWizardState;
  onChange: (sorts: Array<{ field: string; order: 'asc' | 'desc' }>) => void;
}) {
  const t = useT();
  // 可排序字段：常规/日期字段（排除关联与附件）
  const candidates = useMemo(() => {
    const fields = state.meta?.fields || [];
    return fields.filter(
      (f) => !f.ignored && !f.attachment && !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type),
    );
  }, [state.meta?.fields]);

  return (
    <Card
      size="small"
      title={
        <span>
          <TagsOutlined /> {t('导出排序（最多3级）')}
        </span>
      }
      style={{ marginBottom: 12 }}
    >
      <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
        {t('按所选字段排序导出数据；未配置时按数据表默认顺序（ID 升序）。')}
      </div>
      {state.sorts.map((s, idx) => {
        const field = state.meta?.fields.find((f) => f.name === s.field);
        return (
          <Space key={idx} style={{ marginBottom: 8 }}>
            <Select
              size="small"
              style={{ minWidth: 220 }}
              placeholder={t('选择排序字段')}
              value={s.field || undefined}
              onChange={(v) => {
                const next = [...state.sorts];
                next[idx] = { field: v, order: next[idx]?.order || 'asc' };
                onChange(next);
              }}
              options={candidates
                .filter((f) => f.name === s.field || !state.sorts.some((x) => x.field === f.name))
                .map((f) => ({ value: f.name, label: `${f.title}(${f.name})` }))}
              showSearch
              optionFilterProp="label"
            />
            <Select
              size="small"
              style={{ width: 100 }}
              value={s.order}
              onChange={(v) => {
                const next = [...state.sorts];
                next[idx] = { ...next[idx], order: v };
                onChange(next);
              }}
              options={[
                { value: 'asc', label: `↑ ${t('升序')}` },
                { value: 'desc', label: `↓ ${t('降序')}` },
              ]}
            />
            <Button type="text" size="small" danger onClick={() => onChange(state.sorts.filter((_, i) => i !== idx))}>
              <DeleteOutlined />
            </Button>
            {field && (
              <Tag color="default" style={{ fontSize: 11 }}>
                {t('排序字段')} {idx + 1}
              </Tag>
            )}
          </Space>
        );
      })}
      {state.sorts.length < 3 && (
        <Button size="small" type="dashed" onClick={() => onChange([...state.sorts, { field: '', order: 'asc' }])}>
          + {t('添加排序条件')}
        </Button>
      )}
    </Card>
  );
}
