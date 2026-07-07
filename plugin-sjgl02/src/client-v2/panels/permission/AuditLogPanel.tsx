import React from 'react';
import { Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
import { useAPI } from '../../utils/api';

interface AuditLogPanelProps {
  visible: boolean;
}

export default function AuditLogPanel({ visible }: AuditLogPanelProps) {
  const api = useAPI();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const [logLoading, setLogLoading] = React.useState(false);

  const loadAuditLogs = React.useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await api.request({
        url: 'sjgl02_permission_logs:list',
        method: 'get',
        params: { sort: ['-createdAt'], pageSize: 50 },
      });
      const rows = res?.data?.data?.rows || res?.data?.data || [];
      setAuditLogs(Array.isArray(rows) ? rows : []);
    } catch {
      setAuditLogs([]);
    } finally {
      setLogLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    if (visible) {
      loadAuditLogs();
    }
  }, [visible, loadAuditLogs]);

  const auditColumns = [
    {
      title: t('Time'),
      dataIndex: 'createdAt',
      width: 140,
      render: (v: any) => (v ? new Date(v).toLocaleString('zh-CN') : '—'),
    },
    {
      title: t('Operator'),
      dataIndex: 'operator',
      width: 80,
      render: (v: any) => v?.nickname || v?.username || t('System'),
    },
    {
      title: t('Operation'),
      dataIndex: 'action',
      width: 70,
      render: (v: string) => {
        const m: any = {
          create: <Tag color="green">{t('Create')}</Tag>,
          update: <Tag color="orange">{t('Update')}</Tag>,
          delete: <Tag color="red">{t('Delete')}</Tag>,
          toggle: <Tag color="blue">{t('Toggle')}</Tag>,
        };
        return m[v] || <Tag>{v}</Tag>;
      },
    },
    { title: t('Target'), dataIndex: 'targetName', width: 100 },
    { title: t('Table'), dataIndex: 'tableName', width: 100 },
    {
      title: t('Change summary'),
      dataIndex: 'changes',
      render: (v: any) =>
        v
          ? v.after && !v.before
            ? t('New permission')
            : !v.after
              ? t('Remove permission')
              : t('Modify configuration')
          : '—',
    },
  ];

  return (
    <Table
      columns={auditColumns}
      dataSource={auditLogs}
      rowKey="id"
      size="small"
      loading={logLoading}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      locale={{ emptyText: t('No operation logs') }}
      expandable={{
        expandedRowRender: (record: any) => (
          <div style={{ fontSize: 12, color: '#555', padding: 8 }}>
            <b>{t('Change details')}：</b>
            <br />
            {record.changes?.before && (
              <>
                <span style={{ color: '#999' }}>{t('Before')}：</span>
                {JSON.stringify(record.changes.before).substring(0, 300)}
                <br />
              </>
            )}
            {record.changes?.after && (
              <>
                <span style={{ color: '#52c41a' }}>{t('After')}：</span>
                {JSON.stringify(record.changes.after).substring(0, 300)}
              </>
            )}
            {!record.changes?.after && record.changes?.before && (
              <>
                <span style={{ color: '#ff4d4f' }}>{t('Operation result')}：</span>
                {t('Deleted')}
              </>
            )}
          </div>
        ),
      }}
    />
  );
}
