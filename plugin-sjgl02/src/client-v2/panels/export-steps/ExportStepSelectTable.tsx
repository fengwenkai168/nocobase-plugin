import React from 'react';
import { Card, Row, Col, Select, Button } from 'antd';
import { ExportTableItem } from '../export-hooks/exportTypes';

interface ExportStepSelectTableProps {
  loading: boolean;
  tables: ExportTableItem[];
  isAdminOrRoot: boolean;
  selTable: string;
  onSelect: (val: string) => void;
  onNext: () => void;
}

export default function ExportStepSelectTable({
  loading,
  tables,
  isAdminOrRoot,
  selTable,
  onSelect,
  onNext,
}: ExportStepSelectTableProps) {
  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="📋 选择数据表" size="small">
            <Select
              data-testid="export-table-select"
              style={{ width: '100%' }}
              placeholder="— 请选择数据表 —"
              loading={loading}
              showSearch
              value={selTable || undefined}
              onChange={onSelect}
              filterOption={(input, option) =>
                String(option?.label || '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={[
                ...(isAdminOrRoot ? [{ value: '__all__', label: '📦 全部数据表（含系统表）' }] : []),
                ...tables.map((t) => ({ value: t.name, label: `📁 ${t.title} (${t.name})` })),
              ]}
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
              {isAdminOrRoot ? `共 ${tables.length + 1} 个选项` : `共 ${tables.length} 个选项`}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="⚙️ 简要配置" size="small">
            <ul style={{ color: '#666', paddingLeft: 16, fontSize: 13, lineHeight: 1.9 }}>
              <li>支持全字段选择和自定义筛选</li>
              <li>关联字段可选「显示值」或「仅ID」</li>
              <li>自定义文件名模板</li>
            </ul>
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <Button type="primary" disabled={!selTable} onClick={onNext}>
          下一步 →
        </Button>
      </div>
    </div>
  );
}
