import React from 'react';
import { Button, Input, Select, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { ExportWizardState, FilterCondition } from './ExportWizard';

const RELATION_TYPES = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'];

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

export default function FilterSection({
  state,
  onChange,
}: {
  state: ExportWizardState;
  onChange: (next: FilterCondition[]) => void;
}) {
  const t = useT();
  const OP_OPTS = opOptions(t);
  const addFilter = () => {
    const first = state.meta?.fields.find((f) => !RELATION_TYPES.includes(f.type) && !f.attachment);
    onChange([...state.filters, { field: first?.name || '', op: '$eq', value: '' }]);
  };

  return (
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
              onChange(next);
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
              onChange(next);
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
              onChange(next);
            }}
          />
          <Button type="text" size="small" danger onClick={() => onChange(state.filters.filter((_, i) => i !== idx))}>
            <DeleteOutlined />
          </Button>
        </Space>
      ))}
      <div>
        <Button size="small" type="dashed" onClick={addFilter}>
          + {t('添加条件')}
        </Button>
      </div>
    </>
  );
}
