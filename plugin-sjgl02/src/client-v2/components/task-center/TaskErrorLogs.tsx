import React, { useState } from 'react';
import { Button, Space, Table, Tag } from 'antd';
import { BarChartOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useT } from '../../locale';
import { TaskRecord, useApi } from '../../services/api';

const ERROR_PAGE_SIZE = 10;

interface TaskError {
  row: number;
  field: string;
  reason: string;
  raw: unknown;
}

export default function TaskErrorLogs({
  task,
  errors,
  errorGroups,
  fieldLabel,
}: {
  task: TaskRecord;
  errors: TaskError[];
  errorGroups: Array<{ field: string; reason: string; count: number }>;
  fieldLabel: (name: string) => string;
}) {
  const t = useT();
  const api = useApi();
  const [errorLimit, setErrorLimit] = useState(ERROR_PAGE_SIZE);

  const errorColumns = [
    { title: t('Row No.'), dataIndex: 'row', width: 70 },
    { title: t('Field'), dataIndex: 'field', width: 150, render: (v: string) => fieldLabel(v) },
    { title: t('Error Reason'), dataIndex: 'reason', render: (v: string) => <Tag color="red">{v}</Tag> },
    { title: t('Raw Data'), dataIndex: 'raw', width: 180, render: (v: unknown) => String(v ?? '') },
  ];

  if (task.type === 'import' && errors.length > 0) {
    return (
      <>
        {errorGroups.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              <BarChartOutlined /> {t('失败原因 Top {{n}}', { n: errorGroups.length })}
            </div>
            <Space wrap size={4}>
              {errorGroups.map((g, i) => (
                <Tag
                  key={i}
                  color={g.count > errors.length / 2 ? 'red' : g.count > errors.length / 10 ? 'orange' : 'default'}
                >
                  {fieldLabel(g.field)}：{g.reason}（{g.count}）
                </Tag>
              ))}
            </Space>
          </div>
        )}
        <Table
          rowKey={(_r, i) => String(i)}
          size="small"
          pagination={false}
          dataSource={errors.slice(0, errorLimit)}
          columns={errorColumns}
        />
        {errorLimit < errors.length && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Button size="small" onClick={() => setErrorLimit(errorLimit + ERROR_PAGE_SIZE)}>
              {t('Load More')}（{Math.min(errorLimit, errors.length)} / {errors.length}）
            </Button>
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Button size="small" danger onClick={() => api.openDownload(api.errorReportUrl(task.id))}>
            {t('Export Error Report (CSV)')}
          </Button>
        </div>
      </>
    );
  }
  if (task.status === 'succeeded') {
    return (
      <div style={{ padding: 12, textAlign: 'center', color: '#52c41a', background: '#f6ffed', borderRadius: 8 }}>
        <CheckCircleFilled />{' '}
        {task.type === 'import' ? t('All rows imported successfully, no failures') : t('Export succeeded')}
      </div>
    );
  }
  return (
    <div style={{ padding: 12, textAlign: 'center', color: '#999' }}>
      {task.message || t('No log records for this task')}
    </div>
  );
}
