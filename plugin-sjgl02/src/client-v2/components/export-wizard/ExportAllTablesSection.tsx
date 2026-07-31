import React from 'react';
import { Select, Space, Switch } from 'antd';
import { CalendarOutlined, LinkOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { ExportWizardState } from './ExportWizard';
import { dateFormatOptions, relationFormatOptions } from './export-options';

export default function ExportAllTablesSection({
  state,
  onChange,
}: {
  state: ExportWizardState;
  onChange: (p: Partial<ExportWizardState>) => void;
}) {
  const t = useT();
  const DATE_OPTS = dateFormatOptions(t);
  const REL_OPTS = relationFormatOptions(t);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
            <CalendarOutlined /> {t('日期时间导出格式（全局）')}
          </div>
          <Select
            style={{ width: '100%' }}
            value={state.globalDateFormat}
            onChange={(v) => onChange({ globalDateFormat: v })}
            options={DATE_OPTS}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{t('所有表的日期时间字段统一使用此格式导出')}</div>
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
            <LinkOutlined /> {t('关联值导出格式（全局）')}
          </div>
          <Select
            style={{ width: '100%' }}
            value={state.globalRelationFormat}
            onChange={(v) => onChange({ globalRelationFormat: v })}
            options={REL_OPTS}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{t('所有表的关联字段统一使用此格式导出')}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <Space>
          <Switch checked={state.exportAttachment} onChange={(v) => onChange({ exportAttachment: v })} />
          <span style={{ fontSize: 13 }}>
            <PaperClipOutlined /> {t('导出附件（各表附件文件一并打包进 tar.gz）')}
          </span>
        </Space>
      </div>
    </>
  );
}
