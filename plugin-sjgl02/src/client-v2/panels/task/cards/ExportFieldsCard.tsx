import React from 'react';
import { Tabs, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import { FieldTag, TableTag } from '../shared';
import { CardWrap } from './index';

export function ExportFieldsCard({ task, fieldTitles, tableTitles, assocFieldTitles, assocFieldMap }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  if (task.taskType !== 'export') return null;
  const mainFields = (task.selectedFields || []).filter((f: string) => f.indexOf('.') < 0);
  const assocTables = task.associationSheetTables || [];

  if (mainFields.length === 0 && assocTables.length === 0) return null;

  const tabItems: any[] = [];
  if (mainFields.length > 0) {
    tabItems.push({
      key: 'main',
      label: t('Main table fields'),
      children: (
        <Space wrap>
          {mainFields.map((f: string) => (
            <FieldTag key={f} name={f} title={fieldTitles[f]} />
          ))}
        </Space>
      ),
    });
  }
  assocTables.forEach((assocTable: string) => {
    const assocInfo = assocFieldMap?.[assocTable];
    const afields = assocFieldTitles?.[assocTable] || {};
    const fieldEntries = Object.entries(afields) as [string, string][];
    tabItems.push({
      key: assocTable,
      label: assocInfo
        ? `${assocInfo.fieldTitle}(${assocInfo.fieldName}) → ${tableTitles?.[assocTable] || assocTable}(${assocTable})`
        : `${tableTitles?.[assocTable] || assocTable}(${assocTable})`,
      children:
        fieldEntries.length > 0 ? (
          <Space wrap>
            {fieldEntries.map(([name, title]) => (
              <FieldTag key={name} name={name} title={title} />
            ))}
          </Space>
        ) : (
          <span style={{ color: '#6b7280', fontSize: 13 }}>{t('All fields of this table exported')}</span>
        ),
    });
  });

  return (
    <CardWrap title={t('Export fields')}>
      <Tabs size="small" items={tabItems} />
    </CardWrap>
  );
}
