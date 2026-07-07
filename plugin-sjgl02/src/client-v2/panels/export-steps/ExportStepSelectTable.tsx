import React from 'react';
import { Card, Row, Col, Select, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
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
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title={`📋 ${t('Select target table')}`} size="small">
            <Select
              data-testid="export-table-select"
              style={{ width: '100%' }}
              placeholder={t('Please select a table')}
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
                ...(isAdminOrRoot
                  ? [{ value: '__all__', label: `📦 ${t('All tables including system tables')}` }]
                  : []),
                ...tables.map((t) => ({ value: t.name, label: `📁 ${t.title} (${t.name})` })),
              ]}
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
              {t('{{count}} options', { count: isAdminOrRoot ? tables.length + 1 : tables.length })}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title={`⚙️ ${t('Brief configuration')}`} size="small">
            <ul style={{ color: '#666', paddingLeft: 16, fontSize: 13, lineHeight: 1.9 }}>
              <li>{t('Supports full field selection and custom filtering')}</li>
              <li>{t('Association fields can choose display value or ID only')}</li>
              <li>{t('Custom file name template')}</li>
            </ul>
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <Button type="primary" disabled={!selTable} onClick={onNext}>
          {t('Next step')} →
        </Button>
      </div>
    </div>
  );
}
