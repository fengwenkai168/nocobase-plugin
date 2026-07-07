import React from 'react';
import { Card, Row, Col, Select, Button, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
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
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title={`📋 ${t('Select target table')}`} size="small">
            <Select
              data-testid="import-table-select"
              style={{ width: '100%' }}
              placeholder={t('Please select a table')}
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
            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
              {t('{{count}} tables', { count: tables.length })}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title={`ℹ️ ${t('Import instructions')}`} size="small">
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
              <p>
                • {t('Supports .xlsx / .xls / .csv')}: <strong>.xlsx</strong> / <strong>.xls</strong> /{' '}
                <strong>.csv</strong>
              </p>
              <p>
                • {t('File max 50 MB')}: <strong>50 MB</strong>
              </p>
              <p>
                • {t('Three modes: insert, update, upsert')}: <Tag color="blue">{t('Insert only')}</Tag>{' '}
                <Tag color="green">{t('Update only')}</Tag> <Tag color="orange">{t('Upsert')}</Tag>
              </p>
            </div>
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <Button type="primary" disabled={!selectedTable} onClick={onNext}>
          {t('Next step')} →
        </Button>
      </div>
    </div>
  );
}
