import React from 'react';
import { Table, Select, Input, Tag } from 'antd';

interface ImportMappingTableProps {
  tableFields: any[];
  excelHeaders: string[];
  permImportFields: string[];
  permRequiredFields: string[];
  permUniqueFields: string[];
  uniqueFields: string[];
  fieldMapping: Record<string, string>;
  customValues: Record<string, string>;
  onFieldMappingChange: (mapping: Record<string, string>) => void;
  onCustomValuesChange: (values: Record<string, string>) => void;
}

export default function ImportMappingTable({
  tableFields,
  excelHeaders,
  permImportFields,
  permRequiredFields,
  permUniqueFields,
  uniqueFields,
  fieldMapping,
  customValues,
  onFieldMappingChange,
  onCustomValuesChange,
}: ImportMappingTableProps) {
  const displayFields =
    permImportFields.length > 0
      ? tableFields.filter(
          (f: any) =>
            permImportFields.includes(f.name) ||
            permUniqueFields.includes(f.name) ||
            permRequiredFields.includes(f.name),
        )
      : tableFields;

  return (
    <Table
      data-testid="import-mapping-table"
      dataSource={displayFields.map((f: any, i: number) => ({ field: f, key: i }))}
      columns={[
        {
          title: 'Excel列 / 自定义值',
          width: 220,
          render: (record: any) => {
            const isUpdatedAt = record.field?.interface === 'updatedAt';
            const val = fieldMapping[record.field.name];
            const isCustom = val === '__custom__';
            const used = Object.values(fieldMapping).filter((v) => v && v !== '__ignore__' && v !== '__custom__');
            return (
              <div>
                {isUpdatedAt ? (
                  <span style={{ color: '#999', lineHeight: '32px' }}>—</span>
                ) : (
                  <Select
                    style={{ width: '100%' }}
                    placeholder="忽略"
                    value={val || undefined}
                    onChange={(v) => onFieldMappingChange({ ...fieldMapping, [record.field.name]: v })}
                    allowClear
                  >
                    <Select.Option value="__ignore__">🚫 忽略</Select.Option>
                    <Select.Option value="__custom__">✏️ 自定义固定值</Select.Option>
                    {excelHeaders.map((h: string) => (
                      <Select.Option key={h} value={h} disabled={used.includes(h) && val !== h}>
                        {h}
                        {used.includes(h) && val !== h ? ' (已用)' : ''}
                      </Select.Option>
                    ))}
                  </Select>
                )}
                {isCustom && !isUpdatedAt && (
                  <Input
                    size="small"
                    style={{ marginTop: 4 }}
                    placeholder="输入固定值"
                    value={customValues[record.field.name] || ''}
                    onChange={(e) =>
                      onCustomValuesChange({
                        ...customValues,
                        [record.field.name]: e.target.value,
                      })
                    }
                  />
                )}
              </div>
            );
          },
        },
        { title: '→', width: 30, render: () => <span style={{ color: '#999' }}>→</span> },
        {
          title: '映射方式',
          width: 80,
          render: (record: any) => {
            if (record.field?.interface === 'updatedAt') return <Tag color="orange">🔒 只读</Tag>;
            const val = fieldMapping[record.field.name];
            if (!val || val === '__ignore__') return <Tag>忽略</Tag>;
            if (val === '__custom__') return <Tag color="green">固定值</Tag>;
            return <Tag color="blue">Excel列</Tag>;
          },
        },
        { title: '→', width: 30, render: () => <span style={{ color: '#999' }}>→</span> },
        {
          title: '工作表字段',
          width: 150,
          render: (record: any) => (
            <span>
              {record.field.isRequired && <span style={{ color: '#ff4d4f' }}>* </span>}
              {record.field.uiSchema?.title || record.field.name}({record.field.name})
              {uniqueFields.includes(record.field.name) && (
                <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>
                  🔑 唯一值
                </Tag>
              )}
              {permRequiredFields.includes(record.field.name) && (
                <Tag color="volcano" style={{ marginLeft: 4, fontSize: 10 }}>
                  ⚠ 必填
                </Tag>
              )}
            </span>
          ),
        },
      ]}
      pagination={false}
      size="small"
    />
  );
}
