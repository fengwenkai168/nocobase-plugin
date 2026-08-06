import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Card, Collapse, Descriptions, Drawer, Progress, Space, Tag } from 'antd';
import { BarChartOutlined, CheckCircleFilled, FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { TaskRecord, useApi } from '../../services/api';
import { modeLabel } from '../import-wizard/modeLabels';
import TaskErrorLogs from './TaskErrorLogs';
import TaskPreviewTable from './TaskPreviewTable';

interface TaskError {
  row: number;
  field: string;
  reason: string;
  raw: unknown;
}

export default function TaskDrawer({
  taskId,
  onClose,
  onChanged,
}: {
  taskId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [fieldTitles, setFieldTitles] = useState<Record<string, string>>({});
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    if (!taskId) return;
    const data = await api.getTask(taskId);
    setTask(data);
    if (data.collectionName && data.collectionName !== '__all__') {
      try {
        const meta = await api.getCollectionMeta(data.collectionName);
        const map: Record<string, string> = {};
        for (const f of meta.fields) map[f.name] = f.title;
        setFieldTitles(map);
      } catch {
        setFieldTitles({});
      }
    } else {
      setFieldTitles({});
    }
    return data;
  }, [api, taskId]);

  const fieldLabel = (name: string) => (fieldTitles[name] ? `${fieldTitles[name]}(${name})` : name);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (task && ['pending', 'running'].includes(task.status)) {
      pollRef.current = setInterval(async () => {
        const data = await load();
        if (data && !['pending', 'running'].includes(data.status)) {
          clearInterval(pollRef.current);
          onChanged();
        }
      }, 2000);
    }
    return () => clearInterval(pollRef.current);
  }, [task?.status, load, onChanged]);

  const result = (task?.result || {}) as Record<string, unknown>;
  const errors = useMemo(() => (result.errors || []) as TaskError[], [result]);
  // 失败原因聚合：按 字段+原因 统计 Top10（降序）
  const errorGroups = useMemo(() => {
    const map = new Map<string, { field: string; reason: string; count: number }>();
    for (const e of errors) {
      const key = `${e.field}\u0000${e.reason}`;
      const item = map.get(key);
      if (item) item.count += 1;
      else map.set(key, { field: e.field, reason: e.reason, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [errors]);

  if (!taskId) return null;

  const params = (task?.params || {}) as Record<string, unknown>;
  const previewRows = (result.previewRows || []) as unknown[][];
  const performanceLog = (result.performanceLog || []) as string[];
  const headers = (result.headers || []) as string[];
  const mapping = (params.mapping || []) as Array<{
    field: string;
    source: string;
    columnName?: string;
    value?: string;
  }>;
  const exportFields = (params.fields || []) as Array<{ field: string }>;
  const percent = task?.progressTotal
    ? Math.round(((task.progressCurrent || 0) / task.progressTotal) * 100)
    : task?.status === 'succeeded'
      ? 100
      : 0;

  const cancel = async () => {
    await api.cancelTask(taskId);
    message.success(t('Task canceled, all written data rolled back in strict mode'));
    await load();
    onChanged();
  };

  const retry = async () => {
    const { taskId: newId } = await api.retryTask(taskId);
    message.success(`${t('Retry task submitted')} #${newId}`);
    onChanged();
  };

  const formatSeconds = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '-';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
  };

  const configItems: Array<[string, React.ReactNode]> = [];
  if (task) {
    configItems.push([t('Task ID'), `#${task.id}`]);
    if (task.fileName || params.fileName)
      configItems.push([t('File Name'), (task.fileName || params.fileName) as string]);
    if (task.fileSize) configItems.push([t('File Size'), `${(task.fileSize / 1024).toFixed(1)} KB`]);
    if (params.sheetName) configItems.push([t('Sheet'), params.sheetName as string]);
    if (params.headerRow) configItems.push([t('Header Row'), `第${params.headerRow}行`]);
    if (params.mode) configItems.push([t('Import Mode'), modeLabel(t, String(params.mode))]);
    if ((params.uniqueFields as string[])?.length)
      configItems.push([t('Unique Fields'), (params.uniqueFields as string[]).map(fieldLabel).join(', ')]);
    if (params.blankStrategy)
      configItems.push([
        t('Blank Strategy'),
        params.blankStrategy === 'clear' ? '按Excel更新（清空）' : '不更新（保留原值）',
      ]);
    if (params.attachmentArchivePath !== undefined || params.exportAttachment !== undefined) {
      configItems.push([
        t('Attachment'),
        params.attachmentArchivePath ? '已上传 tar.gz' : params.exportAttachment ? '是 (tar.gz)' : '否',
      ]);
    }
    if (task.permissionConfigId)
      configItems.push([
        t('Permission Config'),
        task.permissionLabel || `#${task.permissionConfigId} (${task.permissionType || '-'})`,
      ]);
    configItems.push([t('Transaction Mode'), t('Strict mode (rollback all on failure)')]);
  }

  return (
    <Drawer
      title={
        <span>
          <FileTextOutlined /> {t('Task Details')}
          {task ? ` #${task.id}` : ''}
        </span>
      }
      width={900}
      open={!!taskId}
      onClose={onClose}
    >
      {task && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {[
              { label: t('Task Type'), value: task.type === 'import' ? t('Import') : t('Export') },
              { label: t('Status'), value: t(task.status.charAt(0).toUpperCase() + task.status.slice(1)) },
              {
                label: t('Target Table'),
                value: task.collectionTitle
                  ? `${task.collectionTitle}(${task.collectionName})`
                  : task.collectionName || '-',
              },
              {
                label: t('Creator'),
                value: task.createdBy ? (
                  <div style={{ lineHeight: 1.5 }}>
                    <div>
                      {t('昵称')}：{task.createdBy.nickname || '-'}
                    </div>
                    <div>
                      {t('用户名')}：{task.createdBy.username || '-'}
                    </div>
                  </div>
                ) : (
                  task.createdById || '-'
                ),
              },
              { label: t('Created At'), value: task.createdAt ? new Date(task.createdAt).toLocaleString() : '-' },
              { label: t('Completed At'), value: task.doneAt ? new Date(task.doneAt).toLocaleString() : '-' },
              { label: t('Duration'), value: formatSeconds(task.duration) },
              {
                label: t('Data Volume'),
                value: (() => {
                  const typeLabel = task.type === 'import' ? t('Import') : t('Export');
                  if (task.status === 'pending') return '-';
                  if (task.status === 'running')
                    return `${task.progressCurrent ?? 0}/${task.progressTotal ?? 0} ${t('Records')}`;
                  const rows = task.totalRows ?? task.result?.totalRows ?? task.progressTotal ?? 0;
                  return `${typeLabel} ${Number(rows).toLocaleString()} ${t('Records')}`;
                })(),
              },
            ].map((item) => (
              <Card key={item.label} size="small">
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</div>
              </Card>
            ))}
            <Card size="small">
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{t('Progress')}</div>
              <Progress percent={percent} size="small" status={task.status === 'failed' ? 'exception' : undefined} />
            </Card>
          </div>

          <Collapse
            ghost
            defaultActiveKey={['config', 'mapping', 'stats', 'exportFields']}
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'config',
                label: <span style={{ fontWeight: 600 }}>{t('Task Config Details')}</span>,
                children: (
                  <Descriptions
                    column={2}
                    size="small"
                    items={configItems.map(([label, children]) => ({ key: label, label, children }))}
                  />
                ),
              },
              ...(task.type === 'import' && mapping.length > 0
                ? [
                    {
                      key: 'mapping',
                      label: <span style={{ fontWeight: 600 }}>{t('Field Mapping Details')}</span>,
                      children: (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Excel列</th>
                              <th style={{ textAlign: 'left', padding: '4px 8px' }}>{t('Type')}</th>
                              <th style={{ textAlign: 'left', padding: '4px 8px' }}>{t('Field')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mapping.map((m) => (
                              <tr key={m.field} style={{ borderTop: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '4px 8px' }}>
                                  {m.source === 'custom' ? (
                                    `${m.value || ''}`
                                  ) : m.source === 'ignore' ? (
                                    <span style={{ color: '#999' }}>未选择</span>
                                  ) : (
                                    m.columnName
                                  )}
                                </td>
                                <td style={{ padding: '4px 8px' }}>
                                  {m.source === 'custom' ? (
                                    <Tag color="green">固定值</Tag>
                                  ) : m.source === 'ignore' ? (
                                    <Tag>忽略</Tag>
                                  ) : (
                                    <Tag color="blue">Excel列</Tag>
                                  )}
                                </td>
                                <td style={{ padding: '4px 8px' }}>{fieldLabel(m.field)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ),
                    },
                  ]
                : []),
              ...(task.type === 'import'
                ? [
                    {
                      key: 'stats',
                      label: <span style={{ fontWeight: 600 }}>{t('Import Statistics')}</span>,
                      children: (
                        <Descriptions
                          column={3}
                          size="small"
                          items={[
                            {
                              key: '1',
                              label: t('Total Rows'),
                              children: Number(task.totalRows ?? result.totalRows ?? 0),
                            },
                            {
                              key: '2',
                              label: t('Success Rows'),
                              children: (
                                <span style={{ color: '#52c41a' }}>
                                  {Number(task.successRows ?? result.successRows ?? 0)}
                                </span>
                              ),
                            },
                            {
                              key: '3',
                              label: t('Error Rows'),
                              children: (
                                <span style={{ color: (task.errorRows ?? 0) > 0 ? '#ff4d4f' : '#52c41a' }}>
                                  {Number(task.errorRows ?? result.errorRows ?? 0)}
                                </span>
                              ),
                            },
                          ]}
                        />
                      ),
                    },
                  ]
                : []),
              ...(task.type === 'export' && exportFields.length > 0
                ? [
                    {
                      key: 'exportFields',
                      label: <span style={{ fontWeight: 600 }}>{t('Export Fields')}</span>,
                      children: (
                        <Space wrap>
                          {exportFields.map((f) => (
                            <Tag key={f.field} color="blue">
                              {fieldLabel(f.field)}
                            </Tag>
                          ))}
                        </Space>
                      ),
                    },
                  ]
                : []),
              ...(previewRows.length > 0
                ? [
                    {
                      key: 'preview',
                      label: (
                        <span style={{ fontWeight: 600 }}>
                          {task.type === 'import'
                            ? t('Import Data Preview (First 10 Rows)')
                            : t('Export Data Preview (First 10 Rows)')}
                        </span>
                      ),
                      children: (
                        <TaskPreviewTable
                          task={task}
                          previewRows={previewRows}
                          headers={headers}
                          mapping={mapping}
                          fieldLabel={fieldLabel}
                        />
                      ),
                    },
                  ]
                : []),
              ...(performanceLog.length > 0
                ? [
                    {
                      key: 'perf',
                      label: (
                        <span style={{ fontWeight: 600 }}>
                          <BarChartOutlined /> {t('性能日志')}
                        </span>
                      ),
                      children: (
                        <div
                          style={{
                            background: '#f0f5ff',
                            borderRadius: 6,
                            padding: 12,
                            fontSize: 12,
                            fontFamily: 'monospace',
                            lineHeight: 1.8,
                          }}
                        >
                          {performanceLog.map((line, i) => (
                            <div key={i} style={{ color: i % 2 === 0 ? '#333' : '#666' }}>
                              {line}
                            </div>
                          ))}
                        </div>
                      ),
                    },
                  ]
                : []),
              {
                key: 'logs',
                label: <span style={{ fontWeight: 600 }}>{t('All Logs')}</span>,
                children: (
                  <TaskErrorLogs task={task} errors={errors} errorGroups={errorGroups} fieldLabel={fieldLabel} />
                ),
              },
            ]}
          />

          {(['succeeded', 'failed', 'canceled'].includes(task.status) ||
            (task.type === 'import' && ['failed', 'canceled'].includes(task.status))) &&
            (task.fileName || (task.type === 'import' && params.fileName)) && (
              <Card
                size="small"
                style={{
                  marginBottom: 16,
                  background: task.status === 'failed' ? '#fff7f0' : task.status === 'canceled' ? '#fafafa' : '#f0fdf4',
                  borderColor:
                    task.status === 'failed' ? '#ffd8bf' : task.status === 'canceled' ? '#e8e8e8' : '#bbf7d0',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  <FolderOutlined /> {task.fileName || (params.fileName as string)}
                  {task.status === 'failed' && (
                    <Tag color="red" style={{ marginLeft: 8 }}>
                      {t('Failed')}
                    </Tag>
                  )}
                  {task.status === 'canceled' && <Tag style={{ marginLeft: 8 }}>{t('Canceled')}</Tag>}
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', margin: '4px 0 8px' }}>
                  {task.fileSize ? `${(task.fileSize / 1024).toFixed(1)} KB | ` : ''}
                  {task.doneAt ? new Date(task.doneAt).toLocaleString() : ''}
                </div>
                <Space>
                  {task.status === 'succeeded' && task.fileName && (
                    <Button type="primary" size="small" onClick={() => api.openDownload(api.downloadUrl(task.id))}>
                      {t('Download Export File')}
                    </Button>
                  )}
                  {task.type === 'import' && (
                    <Button size="small" onClick={() => api.openDownload(api.downloadUrl(task.id, 'source'))}>
                      {t('Download Import Source File')}
                    </Button>
                  )}
                </Space>
              </Card>
            )}

          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {['pending', 'running'].includes(task.status) && (
              <Button danger size="small" onClick={cancel}>
                ⏹ {t('Cancel Task (Rollback All)')}
              </Button>
            )}
            {task.status === 'succeeded' && task.type === 'export' && (
              <Button size="small" onClick={retry}>
                🔄 {t('Re-export')}
              </Button>
            )}
            <Button size="small" onClick={onClose}>
              {t('Close')}
            </Button>
          </Space>
        </>
      )}
    </Drawer>
  );
}
