import React from 'react';
import { Descriptions, Tag, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import { FieldTag } from '../shared';
import { CardWrap } from './index';

export function ImportConfigCard({ task, fieldTitles }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  if (task.taskType !== 'import') return null;
  const modeLabels: Record<string, string> = {
    insert: `📗 ${t('Insert only')}`,
    update: `📘 ${t('Update only')}`,
    upsert: `📙 ${t('Upsert')}`,
  };
  const blankLabels: Record<string, string> = {
    update: t('Update by Excel value'),
    null: t('Update by NULL'),
    skip: t('Skip'),
  };
  const uniqueFields = task.uniqueFields || [];
  const requiredFields = task.requiredFields || [];

  return (
    <CardWrap title={t('Import configuration')}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label={t('Import mode')}>
          <Tag color="#059669">{modeLabels[task.importMode || 'insert'] || task.importMode}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('Unique key fields')}>
          {uniqueFields.length > 0 ? (
            <Space wrap>
              {uniqueFields.map((f: string) => (
                <span key={f} style={{ color: '#f59e0b' }}>
                  ⭐ <FieldTag name={f} title={fieldTitles[f]} />
                </span>
              ))}
            </Space>
          ) : (
            <span style={{ color: '#9ca3af' }}>—</span>
          )}
        </Descriptions.Item>
        {requiredFields.length > 0 && (
          <Descriptions.Item label={t('Required fields')}>
            <Space wrap>
              {requiredFields.map((f: string) => (
                <span key={f} style={{ color: '#dc2626' }}>
                  ⚠ <FieldTag name={f} title={fieldTitles[f]} />
                </span>
              ))}
            </Space>
          </Descriptions.Item>
        )}
        <Descriptions.Item label={t('Blank cell handling')}>
          <Tag color="#1677ff">📝 {blankLabels[task.blankCellMode] || t('Update by Excel value')}</Tag>
        </Descriptions.Item>
      </Descriptions>
    </CardWrap>
  );
}
