import React, { useState, useEffect } from 'react';
import { Table, Spin } from 'antd';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import { CollapseCard, CardWrap } from './index';

export function DataPreviewCard({ task, api, fieldTitles }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const errorLogs = Array.isArray(task.errorLogs) ? task.errorLogs : [];
  const isImport = task.taskType === 'import';

  // 失败任务：展示错误明细
  if (task.status === 'failed' && (errorLogs.length > 0 || task.errorMessage)) {
    const displayLogs = errorLogs.slice(0, 10);

    // 从 errorLogs snapshot 提取失败行数据做表格
    const failRows: any[] = [];
    const failCols: string[] = [];
    if (displayLogs.length > 0) {
      const colSet = new Set<string>();
      for (const l of displayLogs) {
        try {
          const snap = typeof l.snapshot === 'string' ? JSON.parse(l.snapshot) : l.snapshot || {};
          const row: any = {
            _row: l.excelRow ? t('Row {{row}}', { row: l.excelRow }) : l.row ? t('Row {{row}}', { row: l.row }) : '—',
          };
          Object.keys(snap).forEach((k) => {
            colSet.add(k);
            row[k] = snap[k];
          });
          failRows.push(row);
        } catch {
          // ignore
        }
      }
      failCols.push(...Array.from(colSet));
    }

    const title =
      errorLogs.length > 10
        ? t('Failure details showing first 10 ({{count}})', { count: errorLogs.length })
        : t('Failure details ({{count}})', { count: errorLogs.length });

    return (
      <>
        <CollapseCard title={title} defaultOpen={!!task.errorMessage}>
          {task.errorMessage && (
            <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 8 }}>⚠ {task.errorMessage}</div>
          )}
          {displayLogs.length > 0 && (
            <Table
              dataSource={displayLogs.map((l: any, i: number) => ({ key: i, ...l }))}
              pagination={false}
              size="small"
              columns={
                [
                  {
                    title: t('Row number'),
                    dataIndex: 'row',
                    width: 80,
                    render: (v: any, record: any) => {
                      if (record.excelRow) return t('Excel row {{row}}', { row: record.excelRow });
                      return v ? t('Row {{row}}', { row: v }) : '—';
                    },
                  },
                  {
                    title: t('Error reason'),
                    dataIndex: 'reason',
                    ellipsis: true,
                    render: (v: any) => (
                      <span style={{ color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{String(v || '—')}</span>
                    ),
                  },
                  {
                    title: t('Field value snapshot'),
                    dataIndex: 'snapshot',
                    ellipsis: true,
                    render: (v: any) => {
                      if (!v) return '—';
                      try {
                        const obj = typeof v === 'string' ? JSON.parse(v) : v;
                        return Object.entries(obj)
                          .map(([k, val]: any) => `${k}=${val}`)
                          .join(', ');
                      } catch {
                        return String(v);
                      }
                    },
                  },
                ] as TableColumnsType<Record<string, any>>
              }
            />
          )}
        </CollapseCard>
        {failRows.length > 0 && (
          <CollapseCard title={t('Failure data preview ({{count}} rows)', { count: failRows.length })}>
            <Table
              dataSource={failRows.map((r: any, i: number) => ({ key: i, ...r }))}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={
                [
                  { title: t('Row number'), dataIndex: '_row', width: 80, fixed: 'left' },
                  ...failCols.map((c) => ({ title: c, dataIndex: c, ellipsis: true, width: 120 })),
                ] as TableColumnsType<Record<string, any>>
              }
            />
          </CollapseCard>
        )}
      </>
    );
  }

  // 导入已完成：调用预览 API 获取前 5 条数据
  if (isImport && task.status === 'completed' && task.importFileId) {
    return <ImportPreviewCard task={task} api={api} />;
  }

  // 导出已完成：查询前 N 条数据预览
  if (!isImport && task.status === 'completed' && task.exportFileId) {
    return <ExportPreviewCard task={task} api={api} fieldTitles={fieldTitles} />;
  }

  return null;
}

function ImportPreviewCard({ task, api }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<any>(null);
  const { importFileId, tableName, fieldMapping, customValues, importMode, uniqueFields, sheetName, headerRow, id } =
    task;

  useEffect(() => {
    const loadPreview = async () => {
      if (!importFileId) return;
      try {
        const res = await api.request({
          url: 'sjgl02Import:preview',
          method: 'post',
          data: {
            tableName,
            fileId: importFileId,
            fieldMapping: fieldMapping || {},
            customValues: customValues || {},
            importMode: importMode || 'insert',
            uniqueFields: uniqueFields || [],
            sheetName: sheetName || 'Sheet1',
            headerRow: headerRow || 1,
            previewLimit: 5,
          },
        });
        const d = res?.data?.data || res?.data;
        setPreviewData(d);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [api, id, importFileId, tableName, fieldMapping, customValues, importMode, uniqueFields, sheetName, headerRow]);

  if (loading)
    return (
      <CardWrap title={t('Data preview')}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin /> {t('Loading')}...
        </div>
      </CardWrap>
    );
  if (!previewData?.preview || !previewData.preview.length) {
    return (
      <CollapseCard title={t('Data preview')}>
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
          {t('Import completed, {{total}} rows processed, {{success}} succeeded', {
            total: task.totalRows || 0,
            success: task.processedRows || 0,
          })}
        </div>
        <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 12 }}>
          {t('Unable to load preview data')}
        </div>
      </CollapseCard>
    );
  }

  const rows = previewData.preview;
  const fm = task.fieldMapping || {};
  const cv = task.customValues || {};

  // 基于 fieldMapping 全量构建列和行（含Excel映射、自定义值、忽略）
  const tableFields = Object.keys(fm);
  const cols = tableFields.map((tf) => ({
    title: tf,
    dataIndex: tf,
    ellipsis: true,
    render: (v: any) => {
      if (fm[tf] === '__ignore__') return <span style={{ color: '#9ca3af' }}>{v}</span>;
      if (fm[tf] === '__custom__') return <span style={{ color: '#7c3aed' }}>📝 {v}</span>;
      return v;
    },
  }));

  const tableRows = rows.map((r: any, i: number) => {
    const obj: any = { key: i };
    for (const tf of tableFields) {
      const ec = fm[tf];
      if (ec === '__ignore__') obj[tf] = t('Ignored');
      else if (ec === '__custom__') obj[tf] = cv[tf] || '';
      else obj[tf] = r[ec] !== undefined ? r[ec] : '';
    }
    return obj;
  });

  return (
    <CollapseCard title={t('Data preview (first {{count}})', { count: rows.length })}>
      <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
        {t('Import completed, {{total}} rows processed, {{success}} succeeded', {
          total: task.totalRows || 0,
          success: task.processedRows || 0,
        })}
      </div>
      <Table dataSource={tableRows} columns={cols} pagination={false} size="small" scroll={{ x: 'max-content' }} />
    </CollapseCard>
  );
}

function ExportPreviewCard({ task, api, fieldTitles }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [loading, setLoading] = useState(true);
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!task.tableName || !api || task.tableName === '__all__') return;
      if (!/^[a-zA-Z0-9_]+$/.test(task.tableName)) return;
      try {
        const res = await api.request({
          url: `${task.tableName}:list`,
          method: 'get',
          params: { pageSize: 5 },
        });
        const d = res?.data?.data || res?.data;
        const rows = Array.isArray(d) ? d : d?.rows || d?.data || [];
        setPreviewRows(rows.slice(0, 5));
      } catch {
        setPreviewRows([]);
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [task.id, task.tableName, api]);

  if (loading)
    return (
      <CardWrap title={t('Data preview')}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin /> {t('Loading')}...
        </div>
      </CardWrap>
    );
  if (!previewRows.length) return null;

  const selectedFields = task.selectedFields || [];
  let cols: any[];
  if (selectedFields.length > 0) {
    cols = selectedFields.map((f: any) => {
      const name = typeof f === 'string' ? f : f.name || f.id || String(f);
      const label = fieldTitles?.[name] || name;
      return { title: `${label}(${name})`, dataIndex: name, ellipsis: true };
    });
  } else {
    cols = Object.keys(previewRows[0] || {}).map((k) => {
      const label = fieldTitles?.[k] || k;
      return { title: `${label}(${k})`, dataIndex: k, ellipsis: true };
    });
  }

  return (
    <CollapseCard title={t('Data preview (first {{count}})', { count: previewRows.length })}>
      <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
        {t('Export completed, {{total}} rows processed', { total: task.totalRows || task.processedRows || 0 })}
      </div>
      <Table
        dataSource={previewRows.map((r: any, i: number) => ({ key: i, ...r }))}
        columns={cols}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
      />
    </CollapseCard>
  );
}
