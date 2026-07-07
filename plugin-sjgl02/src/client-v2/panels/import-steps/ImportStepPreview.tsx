import React from 'react';
import { Card, Button, Space, Tag, Empty, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
import { ImportTableItem } from '../import-hooks/importTypes';

interface ImportStepPreviewProps {
  selectedTable: ImportTableItem | null;
  uploadedFileName: string;
  sheetName: string;
  headerRow: number;
  importMode: string;
  previewData: any;
  tableFields: any[];
  uniqueFields: string[];
  fieldMapping: Record<string, string>;
  customValues: Record<string, string>;
  onPrev: () => void;
  onExecute: () => void;
}

export default function ImportStepPreview({
  selectedTable,
  uploadedFileName,
  sheetName,
  headerRow,
  importMode,
  previewData,
  tableFields,
  uniqueFields,
  fieldMapping,
  customValues,
  onPrev,
  onExecute,
}: ImportStepPreviewProps) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const titles = React.useMemo(() => {
    const map: Record<string, string> = {};
    tableFields.forEach((f: any) => {
      map[f.name] = f.uiSchema?.title || f.name;
    });
    return map;
  }, [tableFields]);

  const dataSource = React.useMemo(() => {
    if (!previewData?.preview) return [];
    return previewData.preview.map((r: any, i: number) => {
      const row: any = { key: i };
      Object.entries(fieldMapping).forEach(([fieldName, excelCol]) => {
        if (excelCol === '__custom__') {
          row[fieldName] = customValues[fieldName] || '';
        } else if (excelCol && excelCol !== '__ignore__') {
          row[excelCol] = r[excelCol] !== undefined ? r[excelCol] : '';
        }
      });
      return row;
    });
  }, [previewData, fieldMapping, customValues]);

  const columns = React.useMemo(() => {
    const cols: any[] = [];
    const seen = new Set<string>();
    Object.entries(fieldMapping).forEach(([fieldName, excelCol]) => {
      const disp = titles[fieldName] || fieldName;
      if (excelCol === '__custom__') {
        cols.push({
          title: (
            <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
              <div style={{ color: '#1677ff', fontSize: 11 }}>
                {t('Import field')}: {t('Custom')}
              </div>
              <div style={{ color: '#666', fontSize: 11 }}>
                {t('Table field')}: {disp}({fieldName})
              </div>
            </div>
          ),
          dataIndex: fieldName,
        });
      } else if (excelCol && excelCol !== '__ignore__' && !seen.has(excelCol)) {
        seen.add(excelCol);
        cols.push({
          title: (
            <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
              <div style={{ color: '#1677ff', fontSize: 11 }}>
                {t('Import field')}: {excelCol}
              </div>
              <div style={{ color: '#666', fontSize: 11 }}>
                {t('Table field')}: {disp}({fieldName})
              </div>
            </div>
          ),
          dataIndex: excelCol,
        });
      }
    });
    return cols;
  }, [fieldMapping, titles, t]);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
        📋 {t('Preview confirmation')} — {t('Import target table')}: {selectedTable?.title || selectedTable?.name}（
        {selectedTable?.name}）
      </div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 12 }}>
          <div>
            <span style={{ color: '#999' }}>📁 {t('File')}：</span>
            <Tag color="blue">{uploadedFileName}</Tag>
          </div>
          <div>
            <span style={{ color: '#999' }}>📄 {t('Sheet')}：</span>
            <span>{sheetName}</span>
          </div>
          <div>
            <span style={{ color: '#999' }}>📊 {t('Mode')}：</span>
            <Tag color="orange">
              {importMode === 'insert'
                ? t('Insert only')
                : importMode === 'update'
                  ? t('Update only')
                  : importMode === 'upsert'
                    ? t('Upsert')
                    : importMode}
            </Tag>
          </div>
          <div>
            <span style={{ color: '#999' }}>📈 {t('Estimated')}：</span>
            <span>
              {previewData?.totalRows || 0} {t('rows')}
            </span>
          </div>
          <div>
            <span style={{ color: '#999' }}>📋 {t('Header row')}：</span>
            <span>{t('Row {{row}}', { row: headerRow })}</span>
          </div>
        </div>
        {uniqueFields.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span style={{ color: '#666', fontSize: 12 }}>🔑 {t('Unique key fields')}：</span>
            <Space wrap size={[4, 4]}>
              {uniqueFields.map((f) => {
                const tf = tableFields.find((t: any) => t.name === f);
                return (
                  <Tag key={f} color="orange">
                    {tf?.uiSchema?.title || f}({f})
                  </Tag>
                );
              })}
            </Space>
          </div>
        )}
      </Card>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>👁️ {t('Preview data (first 10 rows)')}</div>
      {previewData?.preview ? (
        <Table dataSource={dataSource} columns={columns} pagination={false} size="small" />
      ) : (
        <Empty description={t('No preview data, please go back to upload file')} />
      )}
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>
          ← {t('Previous step')}
        </Button>
        <Button data-testid="import-execute-btn" type="primary" onClick={onExecute} disabled={!previewData}>
          ▶ {t('Execute import')}
        </Button>
      </div>
    </div>
  );
}
