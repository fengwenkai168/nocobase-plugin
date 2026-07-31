import React from 'react';
import { Radio, Select, Space, Switch, Tag } from 'antd';
import { useT } from '../../locale';
import { ExportWizardState } from './ExportWizard';
import { RELATION_TYPES } from './export-options';

export default function ExportRelationSection({
  state,
  onChange,
}: {
  state: ExportWizardState;
  onChange: (p: Partial<ExportWizardState>) => void;
}) {
  const t = useT();
  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Switch
          checked={state.relationExportEnabled}
          onChange={(v) => onChange({ relationExportEnabled: v, relationFields: v ? state.relationFields : [] })}
        />
        <span style={{ fontSize: 13, color: state.relationExportEnabled ? '#52c41a' : '#999' }}>
          {state.relationExportEnabled ? t('导出关联表') : t('不导出关联表')}
        </span>
      </Space>
      {state.relationExportEnabled ? (
        <>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            {t('选择需要导出关联表数据的关联字段（多选），每个选中的关联表可作为单独Sheet或单独xlsx文件导出')}
          </div>
          <Space wrap style={{ marginBottom: 12 }}>
            {state.relationFields.map((name) => {
              const f = state.meta?.fields.find((x) => x.name === name);
              return (
                <Tag
                  key={name}
                  color={f?.multiple ? 'purple' : 'blue'}
                  closable
                  onClose={() => onChange({ relationFields: state.relationFields.filter((x) => x !== name) })}
                >
                  {f?.title}({name}) -&gt; {f?.target}
                </Tag>
              );
            })}
            <Select
              size="small"
              style={{ minWidth: 200 }}
              placeholder={t('+ 添加关联表')}
              value={null}
              onChange={(v) => onChange({ relationFields: [...state.relationFields, v] })}
              options={(state.meta?.fields || [])
                .filter((f) => RELATION_TYPES.includes(f.type))
                .filter((f) => !state.relationFields.includes(f.name))
                .map((f) => ({ value: f.name, label: `${f.title}(${f.name}) -> ${f.target}` }))}
            />
          </Space>
          <Radio.Group
            value={state.relationExportMode}
            onChange={(e) => onChange({ relationExportMode: e.target.value })}
            options={[
              { value: 'sheet', label: t('关联表作为单独Sheet') },
              { value: 'file', label: t('关联表作为单独xlsx文件') },
            ]}
          />
          <div
            style={{
              fontSize: 12,
              color: '#999',
              background: '#f0f5ff',
              padding: '8px 10px',
              borderRadius: 4,
              marginTop: 8,
            }}
          >
            {t('单独Sheet: Sheet命名 -> 主表字段名称(主表字段标识)-关联表名称(关联表标识)，例: 角色(role)-角色(roles)')}
            <br />
            {t('单独xlsx: 各文件独立命名，多个文件打包为tar.gz下载')}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: '#999' }}>{t('本次导出不包含关联表数据。主表导出仅包含当前表字段。')}</div>
      )}
    </>
  );
}
