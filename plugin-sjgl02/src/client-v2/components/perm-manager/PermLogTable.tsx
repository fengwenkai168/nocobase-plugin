import React, { useCallback, useEffect, useState } from 'react';
import { Button, Select, Space, Table, Tag } from 'antd';
import { useT } from '../../locale';
import { PermLogRecord, useApi } from '../../services/api';

const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  update: 'orange',
  delete: 'red',
  toggle: 'blue',
};
const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '修改',
  delete: '删除',
  toggle: '切换',
};

const FIELD_ARRAY_KEYS = ['uniqueFields', 'requiredFields', 'importFields', 'exportFields'];

export default function PermLogTable({ targetType, targetId }: { targetType: 'user' | 'role'; targetId: string }) {
  const t = useT();
  const api = useApi();
  const [logs, setLogs] = useState<PermLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [fieldMaps, setFieldMaps] = useState<Record<string, Record<string, string>>>({});

  const load = useCallback(async () => {
    const res = await api.getPermLogs({ targetType, targetId, action: actionFilter, pageSize: 100 });
    setLogs(res.data);
    setTotal(Number(res.meta.count || 0));
  }, [api, targetType, targetId, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const names = [...new Set(logs.map((l) => l.collectionName))];
    const missing = names.filter((n) => n && !fieldMaps[n]);
    if (!missing.length) return;
    Promise.all(
      missing.map(async (n) => {
        try {
          const meta = await api.getCollectionMeta(n);
          const map: Record<string, string> = {};
          for (const f of meta.fields) map[f.name] = f.title;
          return [n, map] as const;
        } catch {
          return [n, {}] as const;
        }
      }),
    ).then((entries) => {
      setFieldMaps((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.map((l) => l.collectionName).join(',')]);

  const labelOf = (collectionName: string, name: string) => {
    const title = fieldMaps[collectionName]?.[name];
    return title ? `${title}(${name})` : name;
  };

  const formatValue = (value: Record<string, unknown> | null | undefined, collectionName: string): string => {
    if (!value) return '无（新建）';
    const keys = ['canImport', 'canExport', 'importModes', 'uniqueFields', 'requiredFields', 'importFields', 'exportFields', 'exportFilter'];
    return keys.map((k) => {
      const v = value[k];
      if (FIELD_ARRAY_KEYS.includes(k) && Array.isArray(v)) {
        const labeled = (v as string[]).map((name) => labelOf(collectionName, name));
        return `${k}=[${labeled.join(',')}]`;
      }
      return `${k}=${JSON.stringify(v ?? null)}`;
    }).join(', ');
  };

  const filtered = logs.filter((log) => {
    if (timeRange === 'all') return true;
    const days = timeRange === '7d' ? 7 : 30;
    return log.createdAt && new Date(log.createdAt).getTime() >= Date.now() - days * 86400_000;
  });

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <span style={{ color: '#999' }}>{t('操作类型')}：</span>
        {['all', 'create', 'update', 'delete', 'toggle'].map((a) => (
          <Button key={a} size="small" type={actionFilter === a ? 'primary' : 'default'} onClick={() => setActionFilter(a)}>
            {a === 'all' ? t('全部') : t(ACTION_LABELS[a])}
          </Button>
        ))}
        <span style={{ color: '#999', marginLeft: 12 }}>{t('时间范围')}：</span>
        <Select
          size="small"
          style={{ width: 110 }}
          value={timeRange}
          onChange={setTimeRange}
          options={[
            { value: 'all', label: t('全部') },
            { value: '7d', label: t('最近7天') },
            { value: '30d', label: t('最近30天') },
          ]}
        />
        <span style={{ color: '#999', marginLeft: 'auto' }}>{t('共 {{count}} 条记录', { count: filtered.length })}</span>
      </Space>
      <Table
        rowKey="id"
        size="small"
        dataSource={filtered}
        pagination={{ pageSize: 20, showTotal: (count) => `${t('共 {{count}} 条记录', { count })}` }}
        expandable={{
          expandedRowKeys: [...expanded],
          onExpand: (open, record) => {
            const next = new Set(expanded);
            if (open) next.add(record.id);
            else next.delete(record.id);
            setExpanded(next);
          },
          expandedRowRender: (record) => (
            <div style={{ background: '#fffbe6', padding: 12, fontSize: 12 }}>
              <strong>{t('变更详情')}：</strong>
              <div style={{ color: '#999', marginTop: 4 }}>{t('操作前')}：{formatValue(record.beforeValue, record.collectionName)}</div>
              <div style={{ color: '#52c41a', marginTop: 4 }}>{t('操作后')}：{record.afterValue ? formatValue(record.afterValue, record.collectionName) : <span style={{ color: '#ff4d4f' }}>{t('已删除')}</span>}</div>
            </div>
          ),
        }}
        columns={[
          { title: t('时间'), dataIndex: 'createdAt', width: 150, render: (v: string) => (v ? new Date(v).toLocaleString() : '-') },
          { title: t('操作人'), width: 90, render: (_: unknown, r: PermLogRecord) => r.createdBy?.nickname || r.createdBy?.username || r.createdById || '-' },
          { title: t('操作'), dataIndex: 'action', width: 80, render: (v: string) => <Tag color={ACTION_COLORS[v]}>{t(ACTION_LABELS[v] || v)}</Tag> },
          { title: t('目标'), width: 130, render: (_: unknown, r: PermLogRecord) => `${r.targetName || r.targetId}(${r.targetType === 'user' ? t('用户') : t('角色')})` },
          { title: t('数据表'), dataIndex: 'collectionName', width: 110, render: (v: string) => <strong>{v}</strong> },
          { title: t('变更概要'), dataIndex: 'summary' },
        ]}
      />
    </div>
  );
}
