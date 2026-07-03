// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Button, Space, Select, Input, Modal, Progress, App } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { StatusBadge, TableTag, STATUS_CONFIG, formatTime } from './shared';

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

export function TaskList({ api, onViewTask }: { api: any; onViewTask: (task: any) => void }) {
  const { message, modal } = App.useApp();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskType, setTaskType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tableTitles, setTableTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    api.request({ url: 'sjgl02Permissions:tables', method: 'get' }).then((res: any) => {
      const data = res?.data?.data || [];
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        data.forEach((t: any) => { map[t.name] = t.title || t.name; });
        setTableTitles(map);
      }
    }).catch(() => {});
  }, []);

  const loadTasks = useCallback(() => {
    setLoading(true);
    const params: any = { taskType, status, page, pageSize: 20 };
    if (search.trim()) params.search = search.trim();
    api.request({ url: 'sjgl02Tasks:list', method: 'get', params })
      .then((res: any) => {
        const data = res?.data?.data || {};
        setTasks(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => { setTasks([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [taskType, status, search, page, api]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { const t = setInterval(loadTasks, 15000); return () => clearInterval(t); }, [loadTasks]);

  const handleCancel = (task: any) => {
    modal.confirm({
      title: '确认取消',
      content: `确定要取消任务 #${task.id} 吗？`,
      okText: '确认取消',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.request({ url: 'sjgl02Tasks:cancel', method: 'post', data: { taskId: task.id } });
          message.success('已取消');
          loadTasks();
        } catch { message.error('取消失败'); }
      },
    });
  };

  const getFileName = (task: any) => {
    if (task.fileName) return task.fileName;
    if (task.importFileId) return `📄 附件 #${task.importFileId}`;
    if (task.exportFileId) return `📄 附件 #${task.exportFileId}`;
    return '—';
  };

  const canCancel = (status: string) => status === 'pending' || status === 'processing';

  return (
    <div>
      <div style={{
        background: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 12,
        border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ color: '#666', fontSize: 13 }}>模式：</span>
        <Select value={taskType} onChange={(v) => { setTaskType(v); setPage(1); }} style={{ width: 100 }} size="small" options={TYPE_OPTIONS} />
        <span style={{ color: '#666', fontSize: 13 }}>状态：</span>
        <Select value={status} onChange={(v) => { setStatus(v); setPage(1); }} style={{ width: 100 }} size="small" options={STATUS_OPTIONS} />
        <Input prefix={<SearchOutlined />} placeholder="搜索任务ID/文件名/表名/创建用户" allowClear size="small"
          style={{ width: 260 }} value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Button size="small" onClick={loadTasks}>🔄 刷新</Button>
      </div>
      <Table loading={loading} dataSource={tasks.map((t: any) => ({ ...t, key: t.id }))} size="small"
        pagination={{ current: page, pageSize: 20, total, showTotal: (t: number) => `共 ${t} 条`, showSizeChanger: false, onChange: (p: number) => { setPage(p); loadTasks(); } }}
        columns={[
          { title: '任务ID', dataIndex: 'id', width: 70, render: (v: any) => <span style={{ color: '#3b82f6', fontWeight: 500 }}>#{v}</span> },
          { title: '模式', dataIndex: 'taskType', width: 80, render: (v: any) => (
            <Tag color={v === 'import' ? '#3b82f6' : '#059669'}>{v === 'import' ? '📥 导入' : '📤 导出'}</Tag>
          )},
          { title: '目标数据表', dataIndex: 'tableName', ellipsis: true, render: (v: any) => (
            v === '__all__' ? <Tag color="#7c3aed">📦 全部数据表</Tag> : <span style={{ fontSize: 12 }}>📁 {tableTitles[v] || v}({v})</span>
          )},
          { title: '文件名称', ellipsis: true, render: (_: any, r: any) => getFileName(r) },
          { title: '状态', dataIndex: 'status', width: 150, render: (v: any, r: any) => (
            <div>
              <Space size={4}>
                <StatusBadge status={v} />
                {v === 'processing' && <Progress percent={r.progress || 0} size="small" style={{ width: 60, margin: 0 }} />}
              </Space>
              {v === 'processing' && r.totalRows > 0 && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {r.processedRows || 0}行已{r.taskType === 'import' ? '导入' : '导出'} / 总{r.totalRows}行
                </div>
              )}
            </div>
          )},
          { title: '创建用户', width: 80, render: (_: any, r: any) => {
            const u = r.createdBy;
            if (!u) return '—';
            return u.nickname || u.username || u.name || `#${u.id}`;
          }},
          { title: '创建时间', dataIndex: 'createdAt', width: 140, render: (v: any) => formatTime(v) },
          { title: '完成时间', dataIndex: 'completedAt', width: 140, render: (v: any) => formatTime(v) },
          { title: '操作', width: 170, render: (_: any, r: any) => (
            <Space size={4}>
              <Button type="primary" size="small" ghost onClick={() => onViewTask(r)}>📋 详情</Button>
              {canCancel(r.status) && <Button type="primary" size="small" danger onClick={() => handleCancel(r)}>⏹ 取消</Button>}
            </Space>
          )},
        ]} />
    </div>
  );
}
