import React from 'react';
import { Card, Row, Col, Select, Button, Tag } from 'antd';
import { ImportTableItem } from '../import-hooks/importTypes';

interface ImportStepSelectTableProps {
  loading: boolean;
  tables: ImportTableItem[];
  selectedTable: ImportTableItem | null;
  onSelect: (table: ImportTableItem | null) => void;
  onNext: () => void;
}

export default function ImportStepSelectTable({
  loading,
  tables,
  selectedTable,
  onSelect,
  onNext,
}: ImportStepSelectTableProps) {
  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="📋 选择目标数据表" size="small">
            <Select
              data-testid="import-table-select"
              style={{ width: '100%' }}
              placeholder="— 请选择数据表 —"
              loading={loading}
              showSearch
              value={selectedTable?.name || undefined}
              onChange={(val) => onSelect(tables.find((t) => t.name === val) || null)}
              filterOption={(input, option) =>
                String(option?.label || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={tables.map((t) => ({ value: t.name, label: `📁 ${t.title} (${t.name})` }))}
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>共 {tables.length} 张表</div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="ℹ️ 导入说明" size="small">
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
              <p>
                • 支持 <strong>.xlsx</strong> / <strong>.xls</strong> / <strong>.csv</strong>
              </p>
              <p>
                • 文件最大 <strong>50 MB</strong>
              </p>
              <p>
                • 三种模式：<Tag color="blue">新增</Tag> <Tag color="green">更新</Tag>{' '}
                <Tag color="orange">新增+更新</Tag>
              </p>
            </div>
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <Button type="primary" disabled={!selectedTable} onClick={onNext}>
          下一步 →
        </Button>
      </div>
    </div>
  );
}
