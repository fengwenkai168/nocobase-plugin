import React from 'react';
import { Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import { CollapseCard } from './index';

interface FieldMappingRow {
  key: number;
  excelCol: string;
  mapType: string;
  field: string;
  label: string;
}

export function FieldMappingCard({ task, fieldTitles }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  if (task.taskType !== 'import') return null;
  const mapping = task.fieldMapping || {};
  const entries = Object.entries(mapping).filter(([, v]: any) => v && v !== '__ignore__');
  if (entries.length === 0) {
    const ignored = Object.entries(mapping).filter(([, v]: any) => v === '__ignore__');
    if (ignored.length === 0) return null;
  }
  const uniqueFields = task.uniqueFields || [];
  const requiredFields = task.requiredFields || [];
  const allEntries = Object.entries(mapping);
  const ignored = allEntries.filter(([, v]: any) => v === '__ignore__');
  const displayEntries = [...entries, ...ignored.map(([k]: any) => [k, '__ignore__'])];

  return (
    <CollapseCard title={t('Field mapping')} defaultOpen={false}>
      <Table
        dataSource={displayEntries.map(([k, v]: any, i: number) => {
          const isUnique = uniqueFields.includes(k);
          const isRequired = requiredFields.includes(k);
          const isCustom = v === '__custom__';
          const isIgnored = v === '__ignore__';
          let mapType: string;
          let excelCol: string;
          if (isIgnored) {
            mapType = t('Ignore');
            excelCol = '—';
          } else if (isCustom) {
            mapType = t('Custom');
            excelCol = (task.customValues || {})[k] || t('Custom value');
          } else {
            mapType = t('Excel column');
            excelCol = v;
          }
          let label = '';
          if (isUnique) label += `⭐${t('Unique')}`;
          if (isRequired) label += (label ? ' · ' : '') + `⚠${t('Required')}`;
          const tagColors: Record<string, string> = {
            [t('Excel column')]: '#3b82f6',
            [t('Custom')]: '#d97706',
            [t('Ignore')]: '#9ca3af',
          };
          return { key: i, excelCol, mapType, field: `${fieldTitles[k] || k}(${k})`, label };
        })}
        pagination={false}
        size="small"
        columns={
          [
            { title: t('Excel column / custom value'), dataIndex: 'excelCol', ellipsis: true },
            {
              title: t('Mapping mode'),
              dataIndex: 'mapType',
              width: 90,
              render: (v: string) => {
                const colors: Record<string, string> = {
                  [t('Excel column')]: '#3b82f6',
                  [t('Custom')]: '#d97706',
                  [t('Ignore')]: '#9ca3af',
                };
                return <Tag color={colors[v] || '#999'}>{v}</Tag>;
              },
            },
            { title: t('Table field'), dataIndex: 'field', ellipsis: true },
            {
              title: t('Label'),
              dataIndex: 'label',
              width: 100,
              render: (v: string) => {
                if (!v) return '—';
                return v.split(' · ').map((s: string) => {
                  if (s.includes(t('Unique')))
                    return (
                      <Tag key={s} color="#f59e0b" style={{ fontSize: 11 }}>
                        ⭐ {t('Unique')}
                      </Tag>
                    );
                  if (s.includes(t('Required')))
                    return (
                      <Tag key={s} color="volcano" style={{ fontSize: 11 }}>
                        ⚠ {t('Required')}
                      </Tag>
                    );
                  return null;
                });
              },
            },
          ] as TableColumnsType<FieldMappingRow>
        }
      />
      {entries.filter(([, v]: any) => v === '__custom__').length > 0 && (
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
          {t('Custom values')}：
          {entries
            .filter(([, v]: any) => v === '__custom__')
            .map(([k]: any) => `${(task.customValues || {})[k] || t('Unknown')} → ${fieldTitles[k] || k}(${k})`)
            .join('、')}
        </div>
      )}
    </CollapseCard>
  );
}
