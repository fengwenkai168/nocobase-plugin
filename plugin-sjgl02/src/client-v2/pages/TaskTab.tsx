import React, { useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Drawer, Descriptions, Progress,
  message, Modal, Alert, Empty, Input,
} from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { useAPIClient } from '../hooks/useAPIClientCompat';
import { NAMESPACE } from '../locale';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '排队中' },
  processing: { color: 'blue', label: '进行中' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
};

const TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'import', label: '导入' },
  { value: 'export', label: '导出' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '排队中' },
  { value: 'processing', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

export default function TaskTab() {
  const api = useAPIClient();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [taskType, setTaskType] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchName, setSearchName] = useState('');
  const [logDrawer, setLogDrawer] = useState<{ open: boolean; task: any }>({ open: false, task: null });
  const [tableTitles, setTableTitles] = useState<Record<string, string>>({});

  const { data: tblData } = useRequest(
    () => api.request({ url: 'sjgl02Permissions:tables', method: 'get' }),
    { onSuccess: (res: any) => {
        const tables = res?.data?.data || [];
        if (Array.isArray(tables)) {
          const map: Record<string, string> = {};
          tables.forEach((t: any) => { map[t.name] = t.title || t.name; });
          setTableTitles(map);
        }
      }
    },
  );

  const { data, loading, refresh } = useRequest(
    () => api.request({
      url: 'sjgl02Tasks:list',
      method: 'get',
      params: { taskType, status, page: 1, pageSize: 50 },
    }),
    { refreshDeps: [taskType, status], pollingInterval: 10000 },
  );

  const resp = data?.data;
  let tasks = resp?.items || [];
  if (searchName) {
    tasks = tasks.filter((t: any) => String(t.tableName || '').toLowerCase().includes(searchName.toLowerCase()));
  }

  const handleCancel = (task: any) => {
    Modal.confirm({
      title: t('Confirm operation'),
      content: t('Are you sure to cancel this task'),
      onOk: async () => {
        try {
          await api.request({ url: 'sjgl02Tasks:cancel', method: 'post', data: { taskId: task.id } });
          message.success(t('Saved successfully')); refresh();
        } catch { message.error(t('Save failed')); }
      },
    });
  };

  const handleViewLog = async (task: any) => {
    try {
      const res = await api.request({ url: 'sjgl02Tasks:detail', method: 'get', params: { taskId: task.id } });
      setLogDrawer({ open: true, task: res?.data?.data || task });
    } catch { setLogDrawer({ open: true, task }); }
  };

  const handleDownloadExport = async (taskId: number) => {
    try {
      const res = await api.request({ url: 'sjgl02Export:download', method: 'get', params: { taskId }, responseType: 'blob' });
      const disp = res.headers?.['content-disposition'] || '';
      const m = disp.match(/filename\*=UTF-8''(.+)|filename="?([^";]+)/);
      const name = m ? decodeURIComponent(m[1] || m[2] || 'export.xlsx') : 'export.xlsx';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch { message.error('下载失败'); }
  };

  const handleDownloadImport = async (fileId: number) => {
    try {
      window.open(`/api/attachments:download/${fileId}`);
    } catch { message.error('下载失败'); }
  };

  const columns = [
    { title: t('Task ID'), dataIndex: 'id', key: 'id', render: (id: number) => `#${id}` },
    { title: t('Type'), dataIndex: 'taskType', key: 'taskType', render: (type: string) => <Tag color={type === 'import' ? 'blue' : 'green'}>{type === 'import' ? t('Import task') : t('Export task')}</Tag> },
    { title: t('Target table'), dataIndex: 'tableName', key: 'tableName', render: (v: string) => (tableTitles[v] || v) + '(' + v + ')' },
    { title: t('Status'), dataIndex: 'status', key: 'status', render: (s: string) => { const cfg = STATUS_CONFIG[s] || { color: 'default', label: s }; return <Tag color={cfg.color}>{cfg.label}</Tag>; } },
    { title: t('Progress'), dataIndex: 'progress', key: 'progress', render: (p: number, r: any) => <Progress percent={p} size="small" strokeColor={r.status === 'failed' ? '#ff4d4f' : r.status === 'pending' ? '#d9d9d9' : '#1677ff'} style={{ minWidth: 100 }} /> },
    { title: t('Data count'), key: 'dataCount', render: (_: any, r: any) => `${r.processedRows || 0}/${r.totalRows || 0}` },
    { title: t('Creator'), dataIndex: ['createdBy', 'nickname'], key: 'createdBy', render: (val: string) => val || '—' },
    { title: t('Created at'), dataIndex: 'createdAt', key: 'createdAt', render: (val: string) => val ? new Date(val).toLocaleString() : '—' },
    { title: t('Completed at'), dataIndex: 'completedAt', key: 'completedAt', render: (val: string) => val ? new Date(val).toLocaleString() : '—' },
    { title: t('Actions'), key: 'actions', render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewLog(r)}>👁 {t('View')}</Button>
          {['pending', 'processing'].includes(r.status) && <Button type="link" size="small" danger onClick={() => handleCancel(r)}>⏹ {t('Cancel')}</Button>}
        </Space>),
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ color: '#666', fontSize: 13 }}>{t('Type')}：</span>
          {TYPE_OPTIONS.map(opt => (
            <Button key={opt.value} size="small" type={taskType === opt.value ? 'primary' : 'default'}
              onClick={() => setTaskType(opt.value)}>{opt.label}</Button>
          ))}
          <span style={{ color: '#666', fontSize: 13, marginLeft: 16 }}>{t('Status')}：</span>
          {STATUS_OPTIONS.map(opt => (
            <Button key={opt.value} size="small" type={status === opt.value ? 'primary' : 'default'}
              onClick={() => setStatus(opt.value)}>{opt.label}</Button>
          ))}
          <Input.Search placeholder="搜索表名" allowClear style={{ width: 180 }} value={searchName}
            onChange={e => setSearchName(e.target.value)} onSearch={setSearchName} />
          <Button onClick={refresh}>🔄 刷新</Button>
        </Space>
      </Card>
      <Table columns={columns} dataSource={tasks} loading={loading} rowKey="id" pagination={{ pageSize: 20 }} size="small" />
      <Drawer title={t('Task log')} open={logDrawer.open} onClose={() => setLogDrawer({ open: false, task: null })} width={680}>
        {logDrawer.task && (
          <div>
            <Descriptions title={t('Task summary')} column={2} size="small" bordered>
              <Descriptions.Item label={t('Task ID')}>#{logDrawer.task.id}</Descriptions.Item>
              <Descriptions.Item label={t('Type')}><Tag color={logDrawer.task.taskType === 'import' ? 'blue' : 'green'}>{logDrawer.task.taskType === 'import' ? t('Import task') : t('Export task')}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('Target table')}>{logDrawer.task.tableName === '__all__' ? '全部数据表' : (tableTitles[logDrawer.task.tableName] || logDrawer.task.tableName) + '(' + logDrawer.task.tableName + ')'}</Descriptions.Item>
              <Descriptions.Item label={t('Status')}><Tag color={STATUS_CONFIG[logDrawer.task.status]?.color}>{STATUS_CONFIG[logDrawer.task.status]?.label || logDrawer.task.status}</Tag></Descriptions.Item>
              {logDrawer.task.taskType === 'import' && <Descriptions.Item label="导入模式">{logDrawer.task.importMode || '—'}</Descriptions.Item>}
              <Descriptions.Item label={t('Creator')}>{logDrawer.task.createdBy?.nickname || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('Created at')}>{logDrawer.task.createdAt ? new Date(logDrawer.task.createdAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('Completed at')}>{logDrawer.task.completedAt ? new Date(logDrawer.task.completedAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('Data count')}>{logDrawer.task.processedRows || 0}/{logDrawer.task.totalRows || 0}</Descriptions.Item>
              {logDrawer.task.taskType === 'import' && <Descriptions.Item label="Sheet名称">{logDrawer.task.sheetName || '—'}</Descriptions.Item>}
              <Descriptions.Item label="文件名">{logDrawer.task.importFileId ? `附件 #${logDrawer.task.importFileId}` : logDrawer.task.exportFileId ? `附件 #${logDrawer.task.exportFileId}` : '—'}</Descriptions.Item>
            </Descriptions>
            {logDrawer.task.status === 'completed' && (
              <Alert type="success" showIcon message={
                <Space>
                  <span>{logDrawer.task.taskType === 'import' ? `✅ 导入成功：共 ${logDrawer.task.totalRows} 行，成功导入 ${logDrawer.task.processedRows} 行` : t('File ready for download')}</span>
                  {logDrawer.task.taskType === 'export' && (
                    <Button type="primary" size="small" onClick={() => handleDownloadExport(logDrawer.task.id)}>⬇ {t('Download')}</Button>
                  )}
                  {logDrawer.task.taskType === 'import' && logDrawer.task.importFileId && (
                    <Button type="primary" size="small" onClick={() => handleDownloadImport(logDrawer.task.importFileId)}>⬇ 下载导入源文件</Button>
                  )}
                </Space>
              } style={{ margin: '16px 0' }} />
            )}
            <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>📊 {t('Field mapping details')}</div>
            {logDrawer.task.fieldMapping ? (
              <Table
                dataSource={Object.entries(logDrawer.task.fieldMapping || {}).filter(([, v]) => v && v !== '__ignore__').map(([tableField, excelCol], i) => ({ key: i, tableField, excelCol }))}
                columns={[{ title: '工作表字段', dataIndex: 'tableField' }, { title: '→', width: 30 }, { title: 'Excel列', dataIndex: 'excelCol' }]}
                pagination={false} size="small" />
            ) : logDrawer.task.selectedFields ? (
              <Space wrap>{(logDrawer.task.selectedFields as string[]).map((f: string) => <Tag key={f} color="blue">{f}</Tag>)}</Space>
            ) : <Empty description="暂无映射数据" />}
            <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>❌ {t('Error log')}</div>
            {logDrawer.task.errorLogs && logDrawer.task.errorLogs.length > 0 ? (
              <Table dataSource={logDrawer.task.errorLogs.map((log: any, i: number) => ({ key: i, ...log }))}
                columns={[{ title: t('Row number'), dataIndex: 'row', width: 60 }, { title: 'Excel行', dataIndex: 'excelRow', width: 60 }, { title: t('Error reason'), dataIndex: 'reason' }, { title: t('Field value snapshot'), dataIndex: 'snapshot' }]}
                pagination={false} size="small" />
            ) : <Empty description={t('No errors')} />}
          </div>
        )}
      </Drawer>
    </div>