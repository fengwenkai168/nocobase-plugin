import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Button, Space, Select, Input, Modal, Progress, App } from 'antd';
import type { TableColumnsType } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { StatusBadge, TableTag, STATUS_CONFIG, formatTime } from './shared';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';

export function TaskList({ api, onViewTask }: { api: any; onViewTask: (task: any) => void }) {
  const { message, modal } = App.useApp();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskType, setTaskType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tableTitles, setTableTitles] = useState<Record<string, string>>({});

  const TYPE_OPTIONS = [
    { value: 'all', label: t('All') },
    { value: 'import', label: t('Import task') },
    { value: 'export', label: t('Export task') },
  ];

  const STATUS_OPTIONS = [
    { value: 'all', label: t('All') },
    { value: 'pending', label: t('Pending') },
    { value: 'processing', label: t('Processing') },
    { value: 'completed', label: t('Completed') },
    { value: 'failed', label: t('Failed') },
    { value: 'cancelled', label: t('Cancelled') },
  ];

  useEffect(() => {
    let cancelled = false;
    const loadTableTitles = async () => {
      try {
        const res = await api.request({ url: 'sjgl02Permissions:tables', method: 'get' });
        const data = res?.data?.data || [];
        if (Array.isArray(data) && !cancelled) {
          const map: Record<string, string> = {};
          data.forEach((t: any) => {
            map[t.name] = t.title || t.name;
          });
          setTableTitles(map);
        }
      } catch {
        // 忽略表标题加载失败
      }
    };
    loadTableTitles().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const params: any = { taskType, status, page, pageSize: 20 };
    if (search.trim()) params.search = search.trim();
    try {
      const res = await api.request({ url: 'sjgl02Tasks:list', method: 'get', params });
      const data = res?.data?.data || {};
      setTasks(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setTasks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [taskType, status, search, page, api]);

  useEffect(() => {
    loadTasks().catch(() => {});
  }, [loadTasks]);

  useEffect(() => {
    const t = setInterval(() => {
      loadTasks().catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [loadTasks]);

  const handleCancel = (task: any) => {
    modal.confirm({
      title: t('Confirm operation'),
      content: t('Are you sure to cancel this task', { id: task.id }),
      okText: t('Confirm'),
      cancelText: t('Back'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.request({ url: 'sjgl02Tasks:cancel', method: 'post', data: { taskId: task.id } });
          message.success(t('Cancelled'));
          loadTasks().catch(() => {});
        } catch {
          message.error(t('Cancel failed'));
        }
      },
    });
  };

  const getFileName = (task: any) => {
    if (task.fileName) return task.fileName;
    if (task.importFileId) return `📄 ${t('Attachment')} #${task.importFileId}`;
    if (task.exportFileId) return `📄 ${t('Attachment')} #${task.exportFileId}`;
    return '—';
  };

  const canCancel = (taskStatus: string) => taskStatus === 'pending' || taskStatus === 'processing';

  return (
    <div>
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 12,
          border: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#666', fontSize: 13 }}>{t('Mode')}:</span>
        <Select
          value={taskType}
          onChange={(v) => {
            setTaskType(v);
            setPage(1);
          }}
          style={{ width: 100 }}
          size="small"
          options={TYPE_OPTIONS}
        />
        <span style={{ color: '#666', fontSize: 13 }}>{t('Status')}:</span>
        <Select
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          style={{ width: 100 }}
          size="small"
          options={STATUS_OPTIONS}
        />
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('Search tasks')}
          allowClear
          size="small"
          style={{ width: 260 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Button size="small" onClick={() => loadTasks().catch(() => {})}>
          🔄 {t('Refresh')}
        </Button>
      </div>
      <Table
        data-testid="task-list-table"
        loading={loading}
        dataSource={tasks.map((t: any) => ({ ...t, key: t.id }))}
        size="small"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showTotal: (total: number) => t('Total {count} items', { count: total }),
          showSizeChanger: false,
          onChange: (p: number) => {
            setPage(p);
            loadTasks().catch(() => {});
          },
        }}
        columns={
          [
            {
              title: t('Task ID'),
              dataIndex: 'id',
              width: 70,
              render: (v: any) => <span style={{ color: '#3b82f6', fontWeight: 500 }}>#{v}</span>,
            },
            {
              title: t('Type'),
              dataIndex: 'taskType',
              width: 80,
              render: (v: any) => (
                <Tag color={v === 'import' ? '#3b82f6' : '#059669'}>
                  {v === 'import' ? `📥 ${t('Import')}` : `📤 ${t('Export')}`}
                </Tag>
              ),
            },
            {
              title: t('Target table'),
              dataIndex: 'tableName',
              ellipsis: true,
              render: (v: any) =>
                v === '__all__' ? (
                  <Tag color="#7c3aed">📦 {t('All tables export')}</Tag>
                ) : (
                  <span style={{ fontSize: 12 }}>
                    📁 {tableTitles[v] || v}({v})
                  </span>
                ),
            },
            { title: t('File name'), ellipsis: true, render: (_: any, r: any) => getFileName(r) },
            {
              title: t('Status'),
              dataIndex: 'status',
              width: 150,
              render: (v: any, r: any) => (
                <div>
                  <Space size={4}>
                    <StatusBadge status={v} />
                    {v === 'processing' && (
                      <Progress percent={r.progress || 0} size="small" style={{ width: 60, margin: 0 }} />
                    )}
                  </Space>
                  {v === 'processing' && r.totalRows > 0 && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      {t('{processed} rows {action} / total {total}', {
                        processed: r.processedRows || 0,
                        action: r.taskType === 'import' ? t('imported') : t('exported'),
                        total: r.totalRows,
                      })}
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: t('Creator'),
              width: 80,
              render: (_: any, r: any) => {
                const u = r.createdBy;
                if (!u) return '—';
                return u.nickname || u.username || u.name || `#${u.id}`;
              },
            },
            { title: t('Created at'), dataIndex: 'createdAt', width: 140, render: (v: any) => formatTime(v) },
            { title: t('Completed at'), dataIndex: 'completedAt', width: 140, render: (v: any) => formatTime(v) },
            {
              title: t('Actions'),
              width: 170,
              render: (_: any, r: any) => (
                <Space size={4}>
                  <Button type="primary" size="small" ghost onClick={() => onViewTask(r)}>
                    📋 {t('View')}
                  </Button>
                  {canCancel(r.status) && (
                    <Button type="primary" size="small" danger onClick={() => handleCancel(r)}>
                      ⏹ {t('Cancel')}
                    </Button>
                  )}
                </Space>
              ),
            },
          ] as TableColumnsType<Record<string, any>>
        }
      />
    </div>
  );
}
