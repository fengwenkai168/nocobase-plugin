// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Table, Button, Space, Tabs, Modal, Spin, App } from 'antd';
import { CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons';
import { useApp } from '@nocobase/client-v2';
import { observer } from '@nocobase/flow-engine';
import { StatusBadge, TableTag, FieldTag, DataDot, formatTime, formatFileSize, formatDuration } from './shared';
import { ExecutionLogViewer } from './ExecutionLogViewer';

function CardWrap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card
      title={title}
      size="small"
      style={{ marginBottom: 8, borderRadius: 8 }}
      styles={{ header: { fontSize: 13, fontWeight: 600, minHeight: 36 } }}
    >
      {children}
    </Card>
  );
}

function CollapseCard({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderRadius: 8 }}
      styles={{ header: { fontSize: 13, fontWeight: 600, minHeight: 36 } }}
      title={
        <span style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
          {open ? <CaretDownOutlined /> : <CaretRightOutlined />} {title}
        </span>
      }
    >
      {open && children}
    </Card>
  );
}

export function TaskSummaryCard({ task, api, tableTitles, fieldTitles }: any) {
  const { message, modal } = App.useApp();
  const isImport = task.taskType === 'import';
  const fileExt = task._fileExt || '';
  const isPkg =
    fileExt === 'gz' || (task.taskType === 'export' && (task.includeAttachments || task.tableName === '__all__'));
  const fileId = isImport ? task.importFileId : task.exportFileId;
  const hasFile = fileId && (task.status === 'completed' || task.status === 'failed');

  const getAttachmentUrl = async (): Promise<{ url: string; filename: string }> => {
    if (!fileId) return { url: '', filename: '' };
    try {
      const att = await api.request({ url: 'attachments:get', method: 'get', params: { filterByTk: fileId } });
      const a = att?.data?.data || {};
      const url = a.url || a.preview || (a.path ? `storage/uploads/${a.path}` : '');
      const filename = a.filename || a.title || task.fileName || 'download';
      return { url, filename };
    } catch {
      return { url: '', filename: '' };
    }
  };

  const previewFile = async () => {
    const { url } = await getAttachmentUrl();
    if (!url) {
      message.warning('无法获取文件预览地址');
      return;
    }
    const fileUrl = url.startsWith('http') ? url : `${window.location.origin}/${url.replace(/^\//, '')}`;
    const ext = (task._fileExt || '').toLowerCase().replace('.', '');
    const officeExts = ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'odt'];
    if (officeExts.includes(ext)) {
      window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`, '_blank');
    } else {
      window.open(fileUrl, '_blank');
    }
  };
  const downloadFile = async () => {
    if (!fileId) return;
    let blobUrl: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const { url, filename } = await getAttachmentUrl();
      if (!url) {
        message.error('无法获取文件地址');
        return;
      }
      const fetchUrl = url.startsWith('http') ? url : `/${url.replace(/^\//, '')}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`下载失败，状态码 ${response.status}`);
      const blob = await response.blob();
      blobUrl = window.URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
    } catch {
      message.error('下载失败');
    } finally {
      if (link) document.body.removeChild(link);
      if (blobUrl) setTimeout(() => window.URL.revokeObjectURL(blobUrl!), 60000);
    }
  };

  const showFileInfo = task.status === 'completed' || task.status === 'failed';
  const fileLabel = isImport ? '上传于' : '完成于';
  const failedCount = Array.isArray(task.errorLogs)
    ? task.errorLogs.length
    : Math.max(0, (task.totalRows || 0) - (task.processedRows || 0));
  const successCount = task.processedRows || 0;
  const totalCount = task.totalRows || 0;
  const fileSize = task._fileSize || task.fileSize || 0;

  return (
    <CardWrap title={`${isImport ? '📥 导入任务' : '📤 导出任务'} · 摘要`}>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="任务ID">#{task.id}</Descriptions.Item>
        <Descriptions.Item label="目标数据表">
          <TableTag name={task.tableName} title={tableTitles[task.tableName]} />
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <StatusBadge status={task.status} />
          {task.status === 'processing' && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
              {task.progress || 0}% · {task.processedRows || 0}行已{isImport ? '导入' : '导出'} / 总
              {task.totalRows || 0}行
            </span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="创建人">{task.createdBy?.nickname || '—'}</Descriptions.Item>
        <Descriptions.Item label="数据量">
          <DataDot type="success" count={successCount} />
          <DataDot type="failed" count={failedCount} />
          <DataDot type="total" count={totalCount} />
        </Descriptions.Item>
      </Descriptions>
      <Descriptions column={2} size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label="创建时间">{formatTime(task.createdAt)}</Descriptions.Item>
        <Descriptions.Item label={isImport ? '完成时间' : '完成时间'}>{formatTime(task.completedAt)}</Descriptions.Item>
        <Descriptions.Item label="耗时">{formatDuration(task.createdAt, task.completedAt)}</Descriptions.Item>
        <Descriptions.Item label="文件大小">{formatFileSize(fileSize)}</Descriptions.Item>
      </Descriptions>

      {showFileInfo && (
        <div
          style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginTop: 12, border: '1px solid #e5e7eb' }}
        >
          <div
            style={{
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📄 {task.fileName || task._fileName || `${isImport ? '导入' : '导出'}文件`}</span>
            {isPkg && (
              <Tag color="#7c3aed" style={{ fontSize: 11 }}>
                ZIP压缩包 · 含Excel + 附件
              </Tag>
            )}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
            {fileLabel}: {formatTime(isImport ? task.createdAt : task.completedAt)}
            {fileSize > 0 ? ` / ${formatFileSize(fileSize)}` : ''}
            {fileExt ? ` / .${fileExt}` : ''}
          </div>
          <Space>
            {!isPkg && hasFile && (
              <Button size="small" onClick={previewFile}>
                👁 预览{isImport ? '源文件' : '文件'}
              </Button>
            )}
            {hasFile && (
              <Button size="small" type="primary" ghost onClick={downloadFile}>
                ⬇ 下载{isImport ? '源文件' : '文件'}
              </Button>
            )}
          </Space>
        </div>
      )}

      {!isImport && (
        <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 10, marginTop: 8, border: '1px solid #bae0ff' }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="表头格式">
              <Tag color="blue">
                {task.headerStyle === 'id' ? '字段标识' : task.headerStyle === 'title' ? '字段名' : '字段名(字段标识)'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="包含附件">
              <Tag color={task.includeAttachments ? '#059669' : '#9ca3af'}>
                {task.includeAttachments ? '✅ 是' : '— 否'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="关联数据Sheet">
              <Tag color={task.includeAssociationSheet ? '#059669' : '#9ca3af'}>
                {task.includeAssociationSheet ? '✅ 是' : '— 否'}
              </Tag>
            </Descriptions.Item>
            {task.includeAssociationSheet && task.associationSheetTables?.length > 0 && (
              <Descriptions.Item label="包含的关联表">
                <span style={{ color: '#059669' }}>{task.associationSheetTables.join('、')}</span>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      )}

      {task.status === 'cancelled' && (
        <div
          style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: 12, marginTop: 12 }}
        >
          <span style={{ color: '#9a3412' }}>文件未生成 — 任务已取消，未生成文件</span>
        </div>
      )}

      {task.status === 'processing' &&
        task.totalRows > 0 &&
        (() => {
          const elapsed = Date.now() - new Date(task.createdAt).getTime();
          const rate = (task.processedRows || 1) / Math.max(1, elapsed);
          const remaining = Math.max(1, Math.floor((task.totalRows - (task.processedRows || 0)) / rate / 1000));
          return (
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 8 }}>
              预计剩余时间：约{' '}
              {remaining > 60 ? `${Math.floor(remaining / 60)} 分 ${remaining % 60} 秒` : `${remaining} 秒`}
            </div>
          );
        })()}

      {task.status === 'failed' && task.errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 12, marginTop: 8 }}>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>⚠ 错误报告</div>
          <div style={{ color: '#b91c1c', fontSize: 13 }}>{task.errorMessage}</div>
          {isImport && <div style={{ color: '#991b1b', fontSize: 12, marginTop: 4 }}>已回滚，未写入任何数据</div>}
          {!isImport && <div style={{ color: '#991b1b', fontSize: 12, marginTop: 4 }}>已回滚，未生成文件</div>}
        </div>
      )}

      {task.status === 'processing' && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button
            size="small"
            danger
            onClick={() => {
              modal.confirm({
                title: '确认取消',
                content: `确定要取消任务 #${task.id} 吗？`,
                okText: '确认取消',
                okButtonProps: { danger: true },
                onOk: async () => {
                  try {
                    await api.request({ url: 'sjgl02Tasks:cancel', method: 'post', data: { taskId: task.id } });
                    message.success('已取消');
                  } catch {
                    message.error('取消失败');
                  }
                },
              });
            }}
          >
            ⏹ 取消任务
          </Button>
        </div>
      )}
    </CardWrap>
  );
}

export function ExportFieldsCard({ task, fieldTitles, tableTitles, assocFieldTitles, assocFieldMap }: any) {
  if (task.taskType !== 'export') return null;
  const mainFields = (task.selectedFields || []).filter((f: string) => f.indexOf('.') < 0);
  const assocTables = task.associationSheetTables || [];

  if (mainFields.length === 0 && assocTables.length === 0) return null;

  const tabItems: any[] = [];
  if (mainFields.length > 0) {
    tabItems.push({
      key: 'main',
      label: '主表字段',
      children: (
        <Space wrap>
          {mainFields.map((f: string) => (
            <FieldTag key={f} name={f} title={fieldTitles[f]} />
          ))}
        </Space>
      ),
    });
  }
  assocTables.forEach((assocTable: string) => {
    const assocInfo = assocFieldMap?.[assocTable];
    const afields = assocFieldTitles?.[assocTable] || {};
    const fieldEntries = Object.entries(afields) as [string, string][];
    tabItems.push({
      key: assocTable,
      label: assocInfo
        ? `${assocInfo.fieldTitle}(${assocInfo.fieldName}) → ${tableTitles?.[assocTable] || assocTable}(${assocTable})`
        : `${tableTitles?.[assocTable] || assocTable}(${assocTable})`,
      children:
        fieldEntries.length > 0 ? (
          <Space wrap>
            {fieldEntries.map(([name, title]) => (
              <FieldTag key={name} name={name} title={title} />
            ))}
          </Space>
        ) : (
          <span style={{ color: '#6b7280', fontSize: 13 }}>已导出该表全部字段</span>
        ),
    });
  });

  return (
    <CardWrap title="导出字段">
      <Tabs size="small" items={tabItems} />
    </CardWrap>
  );
}

export function RelationTablesCard({ task, tableTitles, assocFieldMap, api }: any) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const tables = (task.associationSheetTables || []) as string[];
  const shouldRender = task.taskType === 'export' && task.includeAssociationSheet && tables.length > 0;

  useEffect(() => {
    if (!shouldRender) return;
    const loadCounts = async () => {
      const newCounts: Record<string, number> = {};
      await Promise.all(
        tables.map(async (fieldName: string) => {
          const info = assocFieldMap?.[fieldName];
          const targetTable = info?.targetTable;
          if (!targetTable) {
            newCounts[fieldName] = -1;
            return;
          }
          try {
            const res = await api.request({ url: `${targetTable}:list`, method: 'get', params: { pageSize: 1 } });
            const total = res?.data?.meta?.count ?? res?.data?.data?.meta?.count ?? 0;
            newCounts[fieldName] = total;
          } catch {
            newCounts[fieldName] = -1;
          }
        }),
      );
      setCounts(newCounts);
    };
    loadCounts();
  }, [shouldRender, tables, assocFieldMap, api]);

  if (!shouldRender) return null;

  return (
    <CardWrap title="关联表导出详情">
      <Table
        dataSource={tables.map((t: string, i: number) => ({ key: i, fieldName: t }))}
        pagination={false}
        size="small"
        columns={[
          {
            title: 'Sheet名称',
            render: (_: any, r: any) => {
              const info = assocFieldMap?.[r.fieldName];
              return (
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#059669' }}>
                  {info ? `${info.fieldName}-${info.targetTable || r.fieldName}` : r.fieldName}
                </span>
              );
            },
          },
          {
            title: '关联表',
            render: (_: any, r: any) => {
              const info = assocFieldMap?.[r.fieldName];
              const tblName = info?.targetTable || r.fieldName;
              return <TableTag name={tblName} title={tableTitles?.[tblName]} />;
            },
          },
          {
            title: '数据量',
            render: (_: any, r: any) => {
              const c = counts[r.fieldName];
              if (c === undefined) return <Spin size="small" />;
              if (c < 0) return '—';
              return <span style={{ fontWeight: 600 }}>{c.toLocaleString()}</span>;
            },
          },
        ]}
      />
    </CardWrap>
  );
}

export function ImportConfigCard({ task, fieldTitles }: any) {
  if (task.taskType !== 'import') return null;
  const modeLabels: Record<string, string> = {
    insert: '📗 新增(insert)',
    update: '📘 更新(update)',
    upsert: '📙 新增+更新(upsert)',
  };
  const blankLabels: Record<string, string> = { update: '按Excel值更新', null: '按NULL更新', skip: '跳过' };
  const uniqueFields = task.uniqueFields || [];
  const requiredFields =
    task.fieldMapping && typeof task.fieldMapping === 'object'
      ? Object.entries(task.fieldMapping)
          .filter(([k, v]: any) => v && v !== '__ignore__' && v !== '__custom__')
          .slice(0, 5)
          .map(([k]: any) => k)
          .filter((k: string) => k !== 'createdAt' && k !== 'updatedAt')
      : [];

  return (
    <CardWrap title="导入配置">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="导入模式">
          <Tag color="#059669">{modeLabels[task.importMode || 'insert'] || task.importMode}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="唯一值字段">
          {uniqueFields.length > 0 ? (
            <Space wrap>
              {uniqueFields.map((f: string) => (
                <span key={f} style={{ color: '#f59e0b' }}>
                  ⭐ <FieldTag name={f} title={fieldTitles[f]} />
                </span>
              ))}
            </Space>
          ) : (
            <span style={{ color: '#9ca3af' }}>—</span>
          )}
        </Descriptions.Item>
        {requiredFields.length > 0 && (
          <Descriptions.Item label="必填字段">
            <Space wrap>
              {requiredFields.map((f: string) => (
                <span key={f} style={{ color: '#dc2626' }}>
                  ⚠ <FieldTag name={f} title={fieldTitles[f]} />
                </span>
              ))}
            </Space>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="空白单元格处理">
          <Tag color="#1677ff">📝 {blankLabels[task.blankCellMode] || '按Excel值更新'}</Tag>
        </Descriptions.Item>
      </Descriptions>
    </CardWrap>
  );
}

export function FieldMappingCard({ task, fieldTitles }: any) {
  if (task.taskType !== 'import') return null;
  const mapping = task.fieldMapping || {};
  const entries = Object.entries(mapping).filter(([, v]: any) => v && v !== '__ignore__');
  if (entries.length === 0) {
    const ignored = Object.entries(mapping).filter(([, v]: any) => v === '__ignore__');
    if (ignored.length === 0) return null;
  }
  const uniqueFields = task.uniqueFields || [];
  const allEntries = Object.entries(mapping);
  const ignored = allEntries.filter(([, v]: any) => v === '__ignore__');
  const displayEntries = [...entries, ...ignored.map(([k]: any) => [k, '__ignore__'])];

  return (
    <CollapseCard title="字段映射" defaultOpen={false}>
      <Table
        dataSource={displayEntries.map(([k, v]: any, i: number) => {
          const isUnique = uniqueFields.includes(k);
          const isCustom = v === '__custom__';
          const isIgnored = v === '__ignore__';
          let mapType: string;
          let excelCol: string;
          if (isIgnored) {
            mapType = '忽略';
            excelCol = '—';
          } else if (isCustom) {
            mapType = '自定义';
            excelCol = (task.customValues || {})[k] || '自定义内容';
          } else {
            mapType = 'Excel列';
            excelCol = v;
          }
          let label = '';
          if (isUnique) label += '⭐唯一值';
          const tagColors: Record<string, string> = { Excel列: '#3b82f6', 自定义: '#d97706', 忽略: '#9ca3af' };
          return { key: i, excelCol, mapType, field: `${fieldTitles[k] || k}(${k})`, label };
        })}
        pagination={false}
        size="small"
        columns={[
          { title: 'Excel 列 / 自定义值', dataIndex: 'excelCol', ellipsis: true },
          {
            title: '映射方式',
            dataIndex: 'mapType',
            width: 90,
            render: (v: string) => {
              const colors: Record<string, string> = { Excel列: '#3b82f6', 自定义: '#d97706', 忽略: '#9ca3af' };
              return <Tag color={colors[v] || '#999'}>{v}</Tag>;
            },
          },
          { title: '数据表字段', dataIndex: 'field', ellipsis: true },
          {
            title: '标签',
            dataIndex: 'label',
            width: 100,
            render: (v: string) => {
              if (!v) return '—';
              return v.split(' · ').map((s: string) => {
                if (s.includes('唯一值'))
                  return (
                    <Tag key={s} color="#f59e0b" style={{ fontSize: 11 }}>
                      ⭐ 唯一值
                    </Tag>
                  );
                return null;
              });
            },
          },
        ]}
      />
      {entries.filter(([, v]: any) => v === '__custom__').length > 0 && (
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
          自定义值：
          {entries
            .filter(([, v]: any) => v === '__custom__')
            .map(([k]: any) => `${(task.customValues || {})[k] || '（未知）'} → ${fieldTitles[k] || k}(${k})`)
            .join('、')}
        </div>
      )}
    </CollapseCard>
  );
}

export function DataPreviewCard({ task, api, fieldTitles }: any) {
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
          const row: any = { _row: l.excelRow ? `第${l.excelRow}行` : l.row ? `第${l.row}行` : '—' };
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

    return (
      <>
        <CollapseCard
          title={`失败明细（${errorLogs.length} 条${errorLogs.length > 10 ? '，显示前 10 条' : ''}）`}
          defaultOpen={!!task.errorMessage}
        >
          {task.errorMessage && (
            <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 8 }}>⚠ {task.errorMessage}</div>
          )}
          {displayLogs.length > 0 && (
            <Table
              dataSource={displayLogs.map((l: any, i: number) => ({ key: i, ...l }))}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '行号',
                  dataIndex: 'row',
                  width: 80,
                  render: (v: any, record: any) => {
                    if (record.excelRow) return `Excel 第 ${record.excelRow} 行`;
                    return v ? `第 ${v} 行` : '—';
                  },
                },
                {
                  title: '错误原因',
                  dataIndex: 'reason',
                  ellipsis: true,
                  render: (v: any) => (
                    <span style={{ color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{String(v || '—')}</span>
                  ),
                },
                {
                  title: '字段快照',
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
              ]}
            />
          )}
        </CollapseCard>
        {failRows.length > 0 && (
          <CollapseCard title={`失败数据预览（${failRows.length} 行）`}>
            <Table
              dataSource={failRows.map((r: any, i: number) => ({ key: i, ...r }))}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={[
                { title: '行号', dataIndex: '_row', width: 80, fixed: 'left' },
                ...failCols.map((c) => ({ title: c, dataIndex: c, ellipsis: true, width: 120 })),
              ]}
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
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    const loadPreview = async () => {
      if (!task.importFileId) return;
      try {
        const res = await api.request({
          url: 'sjgl02Import:preview',
          method: 'post',
          data: {
            tableName: task.tableName,
            fileId: task.importFileId,
            fieldMapping: task.fieldMapping || {},
            customValues: task.customValues || {},
            importMode: task.importMode || 'insert',
            uniqueFields: task.uniqueFields || [],
            sheetName: task.sheetName || 'Sheet1',
            headerRow: task.headerRow || 1,
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
  }, [task.id]);

  if (loading)
    return (
      <CardWrap title="数据预览">
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin /> 加载中...
        </div>
      </CardWrap>
    );
  if (!previewData?.preview || !previewData.preview.length) {
    return (
      <CollapseCard title="数据预览">
        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
          导入完成，共处理 {task.totalRows || 0} 行，成功 {task.processedRows || 0} 行
        </div>
        <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 12 }}>
          无法加载预览数据（文件可能已删除或格式不支持预览）
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
      if (ec === '__ignore__') obj[tf] = '— 忽略';
      else if (ec === '__custom__') obj[tf] = cv[tf] || '';
      else obj[tf] = r[ec] !== undefined ? r[ec] : '';
    }
    return obj;
  });

  return (
    <CollapseCard title={`数据预览（前 ${rows.length} 条）`}>
      <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
        导入完成，共处理 {task.totalRows || 0} 行，成功 {task.processedRows || 0} 行
      </div>
      <Table dataSource={tableRows} columns={cols} pagination={false} size="small" scroll={{ x: 'max-content' }} />
    </CollapseCard>
  );
}

function ExportPreviewCard({ task, api, fieldTitles }: any) {
  const [loading, setLoading] = useState(true);
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!task.tableName || !api || task.tableName === '__all__') return;
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
  }, [task.id, task.tableName]);

  if (loading)
    return (
      <CardWrap title="数据预览">
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin /> 加载中...
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
    <CollapseCard title={`数据预览（前 ${previewRows.length} 条）`}>
      <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
        导出完成，共处理 {task.totalRows || task.processedRows || 0} 行
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

export function ExecutionLogCard({ task, api }: any) {
  if (!task || !task.id) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <ExecutionLogViewer api={api} taskId={task.id} status={task.status} />
    </div>
  );
}
