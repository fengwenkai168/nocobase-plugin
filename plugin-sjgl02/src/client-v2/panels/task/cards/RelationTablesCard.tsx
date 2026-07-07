import React, { useState, useEffect, useMemo } from 'react';
import { Table, Spin } from 'antd';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import { TableTag } from '../shared';
import { CardWrap } from './index';

interface RelationRow {
  key: number;
  fieldName: string;
}

export function RelationTablesCard({ task, tableTitles, assocFieldMap, api }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const tables = useMemo(() => (task.associationSheetTables || []) as string[], [task.associationSheetTables]);
  const shouldRender = task.taskType === 'export' && task.includeAssociationSheet && tables.length > 0;

  useEffect(() => {
    if (!shouldRender) return;
    const loadCounts = async () => {
      const newCounts: Record<string, number> = {};
      await Promise.all(
        tables.map(async (fieldName: string) => {
          const info = assocFieldMap?.[fieldName];
          const targetTable = info?.targetTable;
          if (!targetTable || !/^[a-zA-Z0-9_]+$/.test(targetTable)) {
            newCounts[fieldName] = -1;
            return;
          }
          try {
            const res = await api.request({ url: `${targetTable}:list`, method: 'get', params: { pageSize: 1 } });
            const total = res?.data?.meta?.count ?? res?.data?.data?.meta?.count ?? 0;
            newCounts[fieldName] = total;
          } catch {
            newCounts[fieldName] = -1;
          }
        }),
      );
      setCounts(newCounts);
    };
    loadCounts();
  }, [shouldRender, tables, assocFieldMap, api]);

  if (!shouldRender) return null;

  return (
    <CardWrap title={t('Association table export details')}>
      <Table
        dataSource={tables.map((t: string, i: number) => ({ key: i, fieldName: t }))}
        pagination={false}
        size="small"
        columns={
          [
            {
              title: t('Sheet name'),
              render: (_: any, r: any) => {
                const info = assocFieldMap?.[r.fieldName];
                return (
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#059669' }}>
                    {info ? `${info.fieldName}-${info.targetTable || r.fieldName}` : r.fieldName}
                  </span>
                );
              },
            },
            {
              title: t('Association table'),
              render: (_: any, r: any) => {
                const info = assocFieldMap?.[r.fieldName];
                const tblName = info?.targetTable || r.fieldName;
                return <TableTag name={tblName} title={tableTitles?.[tblName]} />;
              },
            },
            {
              title: t('Data count'),
              render: (_: any, r: any) => {
                const c = counts[r.fieldName];
                if (c === undefined) return <Spin size="small" />;
                if (c < 0) return '—';
                return <span style={{ fontWeight: 600 }}>{c.toLocaleString()}</span>;
              },
            },
          ] as TableColumnsType<RelationRow>
        }
      />
    </CardWrap>
  );
}
