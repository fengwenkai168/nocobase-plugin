import React from 'react';
import { Table } from 'antd';
import { useT } from '../../locale';
import { TaskRecord } from '../../services/api';

interface MappingItem {
  field: string;
  source: string;
  columnName?: string;
  value?: string;
}

export default function TaskPreviewTable({
  task,
  previewRows,
  headers,
  mapping,
  fieldLabel,
}: {
  task: TaskRecord;
  previewRows: unknown[][];
  headers: string[];
  mapping: MappingItem[];
  fieldLabel: (name: string) => string;
}) {
  const t = useT();
  if (task.type === 'import' && mapping.length > 0) {
    const effectiveMapping = mapping.filter((m) => m.source !== 'ignore');
    return (
      <Table
        rowKey={(_r, i) => String(i)}
        size="small"
        pagination={false}
        scroll={{ x: true }}
        dataSource={previewRows.map((row) => {
          const obj = row as unknown as Record<string, unknown>;
          return Object.fromEntries(
            effectiveMapping.map((m, i) => [`c${i}`, m.source === 'custom' ? m.value || '' : obj[m.field] ?? '']),
          );
        })}
        columns={effectiveMapping.map((m, i) => ({
          title: (
            <span>
              <span style={{ color: '#1677ff', display: 'block' }}>
                {t('导入')}: {m.source === 'custom' ? `${m.value}(${t('自定义')})` : m.columnName}
              </span>
              <span style={{ color: '#999', fontSize: 10, display: 'block' }}>▼</span>
              <span style={{ display: 'block' }}>{fieldLabel(m.field)}</span>
            </span>
          ),
          dataIndex: `c${i}`,
          render: (v: unknown) => String(v ?? ''),
        }))}
      />
    );
  }
  return (
    <Table
      rowKey={(_r, i) => String(i)}
      size="small"
      pagination={false}
      scroll={{ x: true }}
      dataSource={previewRows.map((row) => {
        if (Array.isArray(row)) {
          return Object.fromEntries(row.map((v, i) => [`c${i}`, v]));
        }
        const obj = row as Record<string, unknown>;
        return Object.fromEntries(Object.keys(obj).map((k) => [k, obj[k]]));
      })}
      columns={(headers.length
        ? headers
        : Array.isArray(previewRows[0])
          ? previewRows[0].map((_, i) => `c${i + 1}`)
          : Object.keys(previewRows[0] as Record<string, unknown>)
      ).map((h, i) => ({
        title: fieldLabel(String(h)),
        dataIndex: Array.isArray(previewRows[0]) ? `c${i}` : String(h),
        render: (v: unknown) => String(v ?? ''),
      }))}
    />
  );
}
