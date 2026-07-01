// @ts-nocheck
import React from 'react';
import { Card, Tabs, Button, Space, Select, Table, Tag, Statistic, Row, Col, Input, InputNumber, message, Checkbox, Switch, Steps, Progress, Empty, Descriptions, Drawer, Modal, Form, Radio, Upload, Pagination, Alert } from 'antd';
import { InboxOutlined, TableOutlined } from '@ant-design/icons';
import { VERSION, apiRequest } from './shared';
import { useAPI } from '../../client-v2/utils/api';

const { Dragger } = Upload;

export default function TaskPanel() {
  const client = useAPI();
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [taskType, setTaskType] = React.useState('all');
  const [status, setStatus] = React.useState('all');
  const [drawer, setDrawer] = React.useState<any>(null);
  const [tableTitles, setTableTitles] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    apiRequest(client, 'sjgl02Permissions:tables').then((data) => {
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        data.forEach((t: any) => { map[t.name] = t.title || t.name; });
        setTableTitles(map);
      }
    }).catch(() => {});
  }, []);

  const loadTasks = () => {
    setLoading(true);
    apiRequest(client, 'sjgl02Tasks:list', { params: { taskType, status } }).then((data) => {
      if (data && Array.isArray(data.items)) {
        setTasks(data.items);
      } else {
        setTasks([]);
      }
    }).catch(() => setTasks([])).finally(() => setLoading(false));
  };

  React.useEffect(() => { loadTasks(); }, [taskType, status]);
  React.useEffect(() => { const t = setInterval(loadTasks, 10000); return () => clearInterval(t); }, [taskType, status]);

  const handleView = async (task: any) => {
    try {
      const res = await client.request({ url: 'sjgl02Tasks:detail', method: 'get', params: { taskId: task.id } });
      const t = res?.data?.data || task;
      const fileId = t.exportFileId || t.importFileId;
      if (fileId) {
        try {
          const att = await client.request({ url: 'attachments:get', method: 'get', params: { filterByTk: fileId } });
          t._fileName = att?.data?.data?.filename || att?.data?.data?.title || '';
        } catch { t._fileName = ''; }
      }
      if (t.tableName && t.tableName !== '__all__') {
        try {
          const fd = await client.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: t.tableName } });
          const fields = fd?.data?.data || [];
          const map: Record<string, string> = {};
          (Array.isArray(fields) ? fields : []).forEach((f: any) => { map[f.name] = f.uiSchema?.title || f.name; });
          t._fieldTitles = map;
        } catch { t._fieldTitles = {}; }
      } else {
        t._fieldTitles = {};
      }
      setDrawer(t);
    } catch { setDrawer(task); }
  };
  const handleCancel = (task: any) => {
    Modal.confirm({ title: '确认取消', content: '确定要取消此任务吗？', onOk: async () => {
      await client.request({ url: 'sjgl02Tasks:cancel', method: 'post', data: { taskId: task.id } });
      message.success('已取消'); loadTasks();
    }});
  };

  const statusColors: any = { pending: 'orange', processing: 'blue', completed: 'green', failed: 'red', cancelled: 'default' };
  const statusLabels: any = { pending: '排队中', processing: '进行中', completed: '已完成', failed: '失败', cancelled: '已取消' };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <span style={{ color: '#666' }}>类型：</span>
          <Select value={taskType} onChange={setTaskType} style={{ width: 100 }}
            options={[{ value: 'all', label: '全部' }, { value: 'import', label: '导入' }, { value: 'export', label: '导出' }]} />
          <span style={{ color: '#666' }}>状态：</span>
          <Select value={status} onChange={setStatus} style={{ width: 100 }}
            options={[{ value: 'all', label: '全部' }, { value: 'pending', label: '排队中' }, { value: 'processing', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'failed', label: '失败' }, { value: 'cancelled', label: '已取消' }]} />
          <Button onClick={loadTasks}>🔄 刷新</Button>
        </Space>
      </Card>
      <Table loading={loading} dataSource={tasks.map((t: any) => ({ ...t, key: t.id }))} size="small" pagination={{ pageSize: 20 }}
        columns={[
          { title: '任务ID', dataIndex: 'id', render: (v: any) => `#${v}` },
          { title: '类型', dataIndex: 'taskType', render: (v: any) => <Tag color={v === 'import' ? 'blue' : 'green'}>{v === 'import' ? '导入' : '导出'}</Tag> },
          { title: '目标表', dataIndex: 'tableName', render: (v: any) => (tableTitles[v] || v) + '(' + v + ')' },
          { title: '状态', dataIndex: 'status', render: (v: any) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag> },
          { title: '进度', dataIndex: 'progress', render: (v: any) => <Progress percent={v || 0} size="small" style={{ minWidth: 80 }} /> },
          { title: '数据量', render: (_: any, r: any) => `${r.processedRows || 0}/${r.totalRows || 0}` },
          { title: '创建人', dataIndex: ['createdBy', 'nickname'], render: (v: any) => v || '—' },
          { title: '创建时间', dataIndex: 'createdAt', render: (v: any) => v ? new Date(v).toLocaleString() : '—' },
          { title: '操作', render: (_: any, r: any) => (
            <Space>
              <Button type="link" size="small" onClick={() => handleView(r)}>👁 查看</Button>
              {['pending', 'processing'].includes(r.status) && <Button type="link" size="small" danger onClick={() => handleCancel(r)}>⏹ 取消</Button>}
            </Space>
          )},
        ]} />
      <Drawer title="任务日志" open={!!drawer} onClose={() => setDrawer(null)} width={680}>
        {drawer && (() => {
          const modeLabel = drawer.importMode === 'insert' ? '新增' : drawer.importMode === 'update' ? '更新' : drawer.importMode === 'upsert' ? '新增+更新' : drawer.importMode;
          const fieldTitles = drawer._fieldTitles || {};
          return (<div>
            <Descriptions title="任务摘要" column={2} size="small" bordered>
              <Descriptions.Item label="任务ID">#{drawer.id}</Descriptions.Item>
              <Descriptions.Item label="类型"><Tag color={drawer.taskType === 'import' ? 'blue' : 'green'}>{drawer.taskType === 'import' ? '导入' : '导出'}</Tag></Descriptions.Item>
              <Descriptions.Item label="目标表">{drawer.tableName === '__all__' ? '全部数据表' : (tableTitles[drawer.tableName] || drawer.tableName) + '(' + drawer.tableName + ')'}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColors[drawer.status]}>{statusLabels[drawer.status]}</Tag></Descriptions.Item>
              <Descriptions.Item label="创建人">{drawer.createdBy?.nickname || '—'}</Descriptions.Item>
              <Descriptions.Item label="数据量">{drawer.processedRows || 0}/{drawer.totalRows || 0}</Descriptions.Item>
              {drawer.taskType === 'import' && <Descriptions.Item label="Sheet名称">{drawer.sheetName || '—'}</Descriptions.Item>}
              {drawer.taskType === 'import' && <Descriptions.Item label="导入模式">{modeLabel}</Descriptions.Item>}
              {drawer.taskType === 'import' && <Descriptions.Item label="唯一值字段">{drawer.uniqueFields?.length > 0 ? drawer.uniqueFields.join(', ') : '—'}</Descriptions.Item>}
              <Descriptions.Item label="创建时间">{drawer.createdAt ? new Date(drawer.createdAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{drawer.completedAt ? new Date(drawer.completedAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="文件名">
                {drawer._fileName ? (
                  <Space size={4}>
                    <span>{drawer._fileName}</span>
                    {drawer.importFileId && <Button type="link" size="small" onClick={() => window.open('/api/attachments:download/' + drawer.importFileId)}>⬇ 下载导入源文件</Button>}
                    {drawer.exportFileId && <Button type="link" size="small" onClick={() => {
                      client.request({ url: 'sjgl02Export:download', method: 'get', params: { taskId: drawer.id }, responseType: 'blob' })
                        .then((res: any) => {
                          const disp = res.headers?.['content-disposition'] || '';
                          const m = disp.match(/filename\*=UTF-8''(.+)|filename="?([^";]+)/);
                          const name = m ? decodeURIComponent(m[1] || m[2] || 'export.xlsx') : 'export.xlsx';
                          const url = URL.createObjectURL(res.data);
                          const a = document.createElement('a'); a.href = url; a.download = name; a.click();
                          URL.revokeObjectURL(url);
                        }).catch(() => message.error('下载失败'));
                    }}>⬇ 下载导出文件</Button>}
                  </Space>
                ) : '—'}
              </Descriptions.Item>
            </Descriptions>
            {drawer.errorMessage && (
              <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', padding: '12px 16px', borderRadius: 6, margin: '16px 0' }}>
                ❌ 错误信息：{drawer.errorMessage}
              </div>
            )}
            {drawer.status === 'completed' && drawer.taskType === 'import' && (
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: '12px 16px', borderRadius: 6, margin: '16px 0' }}>
                ✅ 导入成功：共 {drawer.totalRows} 行，成功导入 {drawer.processedRows} 行
              </div>
            )}
            {drawer.fieldMapping && Object.keys(drawer.fieldMapping).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📊 字段映射</div>
                <Table dataSource={Object.entries(drawer.fieldMapping).filter(([, v]: any) => v && v !== '__ignore__').map(([k, v]: any, i: number) => ({
                  key: i,
                  field: (fieldTitles[k] || k) + '(' + k + ')',
                  type: v === '__custom__' ? '固定值写入' : 'Excel列',
                  value: v === '__custom__' ? '（未存储）' : v,
                }))}
                  columns={[
                    { title: '工作表字段', dataIndex: 'field' },
                    { title: '映射方式', width: 90, render: (_:any, r:any) => r.type === '固定值写入' ? <Tag color="green">固定值写入</Tag> : <Tag color="blue">Excel列</Tag> },
                    { title: '→', width: 30 },
                    { title: 'Excel列/固定值', dataIndex: 'value' },
                  ]} pagination={false} size="small" />
              </div>
            )}
            {drawer.taskType === 'export' && drawer.tableName === '__all__' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📦 全部数据表导出</div>
                <div style={{ color: '#666', fontSize: 13 }}>共 {drawer.totalRows || 0} 张表，导出 {drawer.processedRows || 0} 行数据</div>
              </div>
            )}
            {drawer.taskType === 'export' && drawer.tableName !== '__all__' && drawer.selectedFields && drawer.selectedFields.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 导出字段选择</div>
                <Space wrap>{(drawer.selectedFields as string[]).map((f: string) => <Tag key={f} color="blue">{(fieldTitles[f] || f) + '(' + f + ')'}</Tag>)}</Space>
              </div>
            )}
            {drawer.taskType === 'export' && drawer.includeAssociationSheet && drawer.associationSheetTables && (drawer.associationSheetTables as any[]).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📑 关联数据 Sheet（{(drawer.associationSheetTables as any[]).length}个）</div>
                <Space wrap>{(drawer.associationSheetTables as string[]).map((f: string) => <Tag key={f} color="purple">{(fieldTitles[f] || f) + '(' + f + ')'}</Tag>)}</Space>
              </div>
            )}
            {(drawer.errorLogs?.length > 0) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>❌ 错误日志 ({drawer.errorLogs.length}条)</div>
                <Table dataSource={drawer.errorLogs.map((l: any, i: number) => ({ ...l, key: i }))}
                  columns={[{ title: '行号', dataIndex: 'row', width: 60 }, { title: 'Excel行', dataIndex: 'excelRow', width: 60 }, { title: '原因', dataIndex: 'reason' }, { title: '快照', dataIndex: 'snapshot', render: (v: any) => v ? String(v).substring(0, 200) : '—' }]} pagination={false} size="small" />
              </div>
            )}
            {!drawer.errorMessage && (!drawer.fieldMapping || Object.keys(drawer.fieldMapping).length === 0) && (!drawer.selectedFields || drawer.selectedFields.length === 0) && (!drawer.errorLogs || drawer.errorLogs.length === 0) && (
              <Empty description="暂无详细日志" style={{ marginTop: 16 }} />
            )}
          </div>);
        })()}
      </Drawer>
    </div>
  );
}
