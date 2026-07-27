import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Empty, Input, Progress, Space, Table, Tag, App } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  FileOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useT } from '../../locale';
import { TaskRecord, TaskStats, useApi } from '../../services/api';
import TaskDrawer from './TaskDrawer';

const STATUS_META: Record<string, { color: string; labelKey: string }> = {
  succeeded: { color: '#52c41a', labelKey: 'Succeeded' },
  running: { color: '#1677ff', labelKey: 'Running' },
  pending: { color: '#fa8c16', labelKey: 'Pending' },
  failed: { color: '#ff4d4f', labelKey: 'Failed' },
  canceled: { color: '#999', labelKey: 'Canceled' },
};

export default function TaskCenter() {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    succeeded: 0,
    running: 0,
    pending: 0,
    failed: 0,
    canceled: 0,
  });
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [drawerTaskId, setDrawerTaskId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, listData] = await Promise.all([
        api.getStats(),
        api.listTasks({ page, pageSize: 20, type: typeFilter, status: statusFilter, keyword }),
      ]);
      setStats(statsData);
      setTasks(listData.data);
      setTotal(Number(listData.meta.count || 0));
    } catch (error) {
      message.error(String(error));
    } finally {
      setLoading(false);
    }
  }, [api, page, typeFilter, statusFilter, keyword, message]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (stats.running > 0 || stats.pending > 0) refresh();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [stats.running, stats.pending, refresh]);

  const cancelTask = async (id: number) => {
    await api.cancelTask(id);
    message.success(t('Task canceled, all written data rolled back in strict mode'));
    refresh();
  };

  const statCards: Array<{ key: string; label: string; value: number; color: string; icon: React.ReactNode }> = [
    { key: 'all', label: t('Total Tasks'), value: stats.total, color: '#1677ff', icon: <FileOutlined /> },
    { key: 'succeeded', label: t('Succeeded'), value: stats.succeeded, color: '#52c41a', icon: <CheckCircleFilled /> },
    { key: 'running', label: t('Running'), value: stats.running, color: '#1677ff', icon: <SyncOutlined spin /> },
    { key: 'pending', label: t('Pending'), value: stats.pending, color: '#fa8c16', icon: <ClockCircleFilled /> },
    { key: 'failed', label: t('Failed'), value: stats.failed, color: '#ff4d4f', icon: <CloseCircleFilled /> },
    { key: 'canceled', label: t('Canceled'), value: stats.canceled, color: '#999', icon: <StopOutlined /> },
  ];

  const filterButton = (value: string, current: string, setter: (v: string) => void, label: string) => (
    <Button
      key={value}
      size="small"
      type={current === value ? 'primary' : 'default'}
      onClick={() => {
        setter(value);
        setPage(1);
      }}
    >
      {label}
    </Button>
  );

  const columns = [
    { title: t('Task ID'), dataIndex: 'id', width: 80, render: (id: number) => `#${id}` },
    {
      title: t('Type'),
      dataIndex: 'type',
      width: 90,
      render: (type: string) =>
        type === 'import' ? (
          <Tag color="blue">⬇ {t('Import')}</Tag>
        ) : type === 'export' ? (
          <Tag color="green">⬆ {t('Export')}</Tag>
        ) : (
          <Tag>{type}</Tag>
        ),
    },
    {
      title: t('Target Table'),
      dataIndex: 'collectionTitle',
      render: (v: string, row: TaskRecord) => (v ? `${v}(${row.collectionName})` : row.collectionName || '-'),
    },
    {
      title: t('Status'),
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const meta = STATUS_META[status] || { color: '#999', labelKey: status };
        return (
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: meta.color,
                marginRight: 6,
              }}
            />
            {t(meta.labelKey)}
          </span>
        );
      },
    },
    {
      title: t('Progress'),
      width: 170,
      render: (_: unknown, row: TaskRecord) => {
        const percent = row.progressTotal
          ? Math.round(((row.progressCurrent || 0) / row.progressTotal) * 100)
          : row.status === 'succeeded'
            ? 100
            : 0;
        const status = row.status === 'failed' ? 'exception' : undefined;
        return <Progress percent={percent} size="small" status={status} />;
      },
    },
    {
      title: t('Data Volume'),
      width: 110,
      render: (_: unknown, row: TaskRecord) => {
        if (row.status === 'pending') return '-';
        if (row.status === 'running') return `${row.progressCurrent || 0}/${row.progressTotal || 0}`;
        return `${row.totalRows ?? row.progressTotal ?? 0} ${t('Records')}`;
      },
    },
    {
      title: t('Creator'),
      width: 90,
      render: (_: unknown, row: TaskRecord) =>
        row.createdBy?.nickname || row.createdBy?.username || row.createdById || '-',
    },
    {
      title: t('Created At'),
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: t('Actions'),
      width: 170,
      render: (_: unknown, row: TaskRecord) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Button type="link" size="small" onClick={() => setDrawerTaskId(row.id)}>
            {t('View')}
          </Button>
          {['pending', 'running'].includes(row.status) && (
            <Button type="link" size="small" danger onClick={() => cancelTask(row.id)}>
              {t('Cancel')}
            </Button>
          )}
          {row.status === 'succeeded' && row.type === 'export' && (
            <Button type="link" size="small" onClick={() => api.openDownload(api.downloadUrl(row.id))}>
              {t('Download')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {statCards.map((card) => (
          <Card
            key={card.key}
            size="small"
            style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}
            onClick={() => {
              setStatusFilter(card.key);
              setPage(1);
            }}
          >
            <div style={{ fontSize: 18, color: card.color }}>{card.icon}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: card.color }}>{card.value}</div>
          </Card>
        ))}
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Space.Compact>
          {filterButton('all', typeFilter, setTypeFilter, t('All'))}
          {filterButton('import', typeFilter, setTypeFilter, `⬇ ${t('Import')}`)}
          {filterButton('export', typeFilter, setTypeFilter, `⬆ ${t('Export')}`)}
        </Space.Compact>
        <Space.Compact>
          {filterButton('all', statusFilter, setStatusFilter, t('All'))}
          {filterButton('pending', statusFilter, setStatusFilter, `⏳ ${t('Pending')}`)}
          {filterButton('running', statusFilter, setStatusFilter, `🔄 ${t('Running')}`)}
          {filterButton('succeeded', statusFilter, setStatusFilter, `✅ ${t('Succeeded')}`)}
          {filterButton('failed', statusFilter, setStatusFilter, `❌ ${t('Failed')}`)}
          {filterButton('canceled', statusFilter, setStatusFilter, `🚫 ${t('Canceled')}`)}
        </Space.Compact>
        <Input.Search
          allowClear
          placeholder={t('Search table name / task ID...')}
          style={{ width: 220 }}
          onSearch={(v) => {
            setKeyword(v);
            setPage(1);
          }}
        />
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={tasks}
        onRow={(row) => ({ onClick: () => setDrawerTaskId(row.id), style: { cursor: 'pointer' } })}
        locale={{
          emptyText: (
            <Empty
              description={
                <>
                  {t('No matching task records')}
                  <br />
                  <small>{t('Try adjusting filters or search keywords')}</small>
                </>
              }
            />
          ),
        }}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (count) => `${t('Total Tasks')} ${count}`,
        }}
      />

      <TaskDrawer taskId={drawerTaskId} onClose={() => setDrawerTaskId(null)} onChanged={refresh} />
    </div>
  );
}
