import React from 'react';
import { Card, Button, Space, Tag, Empty, Table } from 'antd';
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
              <div style={{ color: '#1677ff', fontSize: 11 }}>导入字段：自定义</div>
              <div style={{ color: '#666', fontSize: 11 }}>
                数据表字段：{disp}({fieldName})
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
              <div style={{ color: '#1677ff', fontSize: 11 }}>导入字段：{excelCol}</div>
              <div style={{ color: '#666', fontSize: 11 }}>
                数据表字段：{disp}({fieldName})
              </div>
            </div>
          ),
          dataIndex: excelCol,
        });
      }
    });
    return cols;
  }, [fieldMapping, titles]);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
        📋 预览确认 — 导入到的数据表：{selectedTable?.title || selectedTable?.name}（{selectedTable?.name}）
      </div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 12 }}>
          <div>
            <span style={{ color: '#999' }}>📁 文件：</span>
            <Tag color="blue">{uploadedFileName}</Tag>
          </div>
          <div>
            <span style={{ color: '#999' }}>📄 Sheet：</span>
            <span>{sheetName}</span>
          </div>
          <div>
            <span style={{ color: '#999' }}>📊 模式：</span>
            <Tag color="orange">
              {importMode === 'insert'
                ? '新增'
                : importMode === 'update'
                  ? '更新'
                  : importMode === 'upsert'
                    ? '新增+更新'
                    : importMode}
            </Tag>
          </div>
          <div>
            <span style={{ color: '#999' }}>📈 预计：</span>
            <span>{previewData?.totalRows || 0} 行</span>
          </div>
          <div>
            <span style={{ color: '#999' }}>📋 表头行：</span>
            <span>第 {headerRow} 行</span>
          </div>
        </div>
        {uniqueFields.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span style={{ color: '#666', fontSize: 12 }}>🔑 唯一值字段：</span>
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
      <div style={{ fontWeight: 600, marginBottom: 8 }}>👁️ 预览数据（前10行）</div>
      {previewData?.preview ? (
        <Table dataSource={dataSource} columns={columns} pagination={false} size="small" />
      ) : (
        <Empty description="暂无预览数据，请返回上一步上传文件" />
      )}
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>
          ← 上一步
        </Button>
        <Button data-testid="import-execute-btn" type="primary" onClick={onExecute} disabled={!previewData}>
          ▶ 执行导入
        </Button>
      </div>
    </div>
  );
}
