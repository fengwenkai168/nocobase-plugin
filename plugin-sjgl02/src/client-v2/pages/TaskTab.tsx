import React, { useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Drawer, Descriptions, Progress,
  message, Modal, Alert, Empty, Select,
} from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '排队中' },
  processing: { color: 'blue', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
};

export default function TaskTab({ ctx }: { ctx: any }) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [taskType, setTaskType] = useState('all');
  const [status, setStatus] = useState('all');
  const [logDrawer, setLogDrawer] = useState<{ open: boolean; task: any }>({ open: false, task: null });

  const { data, loading, refresh } = useRequest(
    () => ctx.api.request({
      url: 'sjgl02Tasks:list',
      method: 'get',
      params: { taskType, status, page: 1, pageSize: 50 },
    }),
    { refreshDeps: [taskType, status] },
  );

  const tasks = data?.data?.data || [];

  const handleCancel = (task: any) => {
    Modal.confirm({
      title: t('Confirm operation'),
      content: t('Are you sure to cancel this task'),
      onOk: async () => {
        try {
          await ctx.api.request({
            url: 'sjgl02Tasks:cancel',
            method: 'post',
            data: { taskId: task.id },
          });
          message.success(t('Saved successfully'));
          refresh();
        } catch {
          message.error(t('Save failed'));
        }
      },
    });
  };

  const handleViewLog = async (task: any) => {
    try {
      const res = await ctx.api.request({
        url: 'sjgl02Tasks:detail',
        method: 'get',
        params: { taskId: task.id },
      });
      setLogDrawer({ open: true, task: res?.data?.data || task });
    } catch {
      setLogDrawer({ open: true, task });
    }
  };

  const columns = [
    {
      title: t('Task ID'),
      dataIndex: 'id',
      key: 'id',
      render: (id: number) => `#${id}`,
    },
    {
      title: t('Type'),
      dataIndex: 'taskType',
      key: 'taskType',
      render: (type: string) => (
        <Tag color={type === 'import' ? 'blue' : 'green'}>
          {type === 'import' ? t('Import task') : t('Export task')}
        </Tag>
      ),
    },
    {
      title: t('Target table'),
      dataIndex: 'tableName',
      key: 'tableName',
    },
    {
      title: t('Status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: t('Progress'),
      dataIndex: 'progress',
      key: 'progress',
      render: (p: number, record: any) => {
        const color = record.status === 'failed' ? 'red' : record.status === 'pending' ? 'gray' : 'blue';
        return (
          <Progress
            percent={p}
            size="small"
            strokeColor={color === 'red' ? '#ff4d4f' : color === 'gray' ? '#d9d9d9' : '#1677ff'}
            style={{ minWidth: 100 }}
          />
        );
      },
    },
    {
      title: t('Data count'),
      key: 'dataCount',
      render: (_: any, record: any) => `${record.processedRows || 0}/${record.totalRows || 0}`,
    },
    {
      title: t('Creator'),
      dataIndex: ['createdBy', 'nickname'],
      key: 'createdBy',
      render: (val: string) => val || '—',
    },
    {
      title: t('Created at'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => val ? new Date(val).toLocaleString() : '—',
    },
    {
      title: t('Completed at'),
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (val: string) => val ? new Date(val).toLocaleString() : '—',
    },
    {
      title: t('Actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewLog(record)}>👁 {t('View')}</Button>
          {['pending', 'processing'].includes(record.status) && (
            <Button type="link" size="small" danger onClick={() => handleCancel(record)}>⏹ {t('Cancel')}</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ color: '#666', fontSize: 13 }}>{t('Type')}：</span>
          <Select
            value={taskType}
            onChange={setTaskType}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: t('All') },
              { value: 'import', label: t('Import task') },
              { value: 'export', label: t('Export task') },
            ]}
          />
          <span style={{ color: '#666', fontSize: 13 }}>{t('Status')}：</span>
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: t('All') },
              { value: 'pending', label: t('Pending') },
              { value: 'processing', label: t('Processing') },
              { value: 'completed', label: t('Completed') },
              { value: 'failed', label: t('Failed') },
              { value: 'cancelled', label: t('Cancelled') },
            ]}
          />
          <Button onClick={refresh}>🔄 刷新</Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={tasks}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        size="small"
      />

      <Drawer
        title={t('Task log')}
        open={logDrawer.open}
        onClose={() => setLogDrawer({ open: false, task: null })}
        width={680}
      >
        {logDrawer.task && (
          <div>
            <Descriptions title={t('Task summary')} column={2} size="small" bordered>
              <Descriptions.Item label={t('Task ID')}>#{logDrawer.task.id}</Descriptions.Item>
              <Descriptions.Item label={t('Type')}>
                <Tag color={logDrawer.task.taskType === 'import' ? 'blue' : 'green'}>
                  {logDrawer.task.taskType === 'import' ? t('Import task') : t('Export task')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('Target table')}>{logDrawer.task.tableName}</Descriptions.Item>
              <Descriptions.Item label={t('Status')}>
                <Tag color={STATUS_CONFIG[logDrawer.task.status]?.color}>
                  {STATUS_CONFIG[logDrawer.task.status]?.label || logDrawer.task.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('Creator')}>{logDrawer.task.createdBy?.nickname || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('Created at')}>
                {logDrawer.task.createdAt ? new Date(logDrawer.task.createdAt).toLocaleString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('Completed at')}>
                {logDrawer.task.completedAt ? new Date(logDrawer.task.completedAt).toLocaleString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('Data count')}>
                {logDrawer.task.processedRows || 0}/{logDrawer.task.totalRows || 0}
              </Descriptions.Item>
            </Descriptions>

            {logDrawer.task.status === 'completed' && (
              <Alert
                type="success"
                showIcon
                message={
                  <Space>
                    <span>{t('File ready for download')}</span>
                    <Button type="primary" size="small">⬇ {t('Download')}</Button>
                  </Space>
                }
                style={{ margin: '16px 0' }}
              />
            )}

            <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
              📊 字段映射详情
            </div>
            {logDrawer.task.fieldMapping ? (
              <Table
                dataSource={Object.entries(logDrawer.task.fieldMapping || {}).map(([k, v], i) => ({
                  key: i, excelCol: k, tableField: v,
                }))}
                columns={[
                  { title: 'Excel列', dataIndex: 'excelCol', key: 'excelCol' },
                  { title: '→', key: 'arrow', width: 30 },
                  { title: '工作表字段', dataIndex: 'tableField', key: 'tableField' },
                ]}
                pagination={false}
                size="small"
              />
            ) : logDrawer.task.selectedFields ? (
              <Space wrap>
                {(logDrawer.task.selectedFields as string[]).map((f: string) => (
                  <Tag key={f} color="blue">{f}</Tag>
                ))}
              </Space>
            ) : (
              <Empty description={t('No permission configured')} />
            )}

            <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
              ❌ 错误日志
            </div>
            {logDrawer.task.errorLogs && logDrawer.task.errorLogs.length > 0 ? (
              <Table
                dataSource={logDrawer.task.errorLogs.map((log: any, i: number) => ({
                  key: i, ...log,
                }))}
                columns={[
                  { title: t('Row number'), dataIndex: 'row', key: 'row' },
                  { title: t('Error reason'), dataIndex: 'reason', key: 'reason' },
                  { title: t('Field value snapshot'), dataIndex: 'snapshot', key: 'snapshot' },
                ]}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description={t('No errors')} />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
