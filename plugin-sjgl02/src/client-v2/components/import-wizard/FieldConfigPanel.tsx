import React from 'react';
import { Radio, Select } from 'antd';
import { useT } from '../../locale';
import { FieldMetaInfo, ImportFieldConfig } from '../../services/api';

const RELATION_TYPES = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'];

export function isRelationField(f?: FieldMetaInfo): boolean {
  return !!f && !f.attachment && RELATION_TYPES.includes(f.type);
}

export function defaultFieldConfig(): ImportFieldConfig {
  return { emptyStrategy: 'skip', notFound: 'fail', updateMode: 'overwrite' };
}

export default function FieldConfigPanel({
  field,
  config,
  mode,
  folders,
  onChange,
}: {
  field: FieldMetaInfo;
  config: ImportFieldConfig;
  mode: string;
  folders: Array<{ name: string; fileCount: number }>;
  onChange: (config: ImportFieldConfig) => void;
}) {
  const t = useT();
  const isAttach = !!field.attachment;
  const isM2o = field.type === 'belongsTo' || field.type === 'hasOne';
  const isUpMode = mode === 'update' || mode === 'upsert';
  const showUpdateMode = isUpMode && !isM2o;
  const color = isAttach ? '#0891b2' : '#722ed1';
  const set = (p: Partial<ImportFieldConfig>) => onChange({ ...config, ...p });

  const row: React.CSSProperties = { marginBottom: 12 };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: 500,
  };

  return (
    <div
      style={{
        border: `1px solid ${isAttach ? '#a5f3fc' : '#d3adf7'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: '12px 16px',
        background: '#fff',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color, marginBottom: 10 }}>
        {isAttach ? '📎' : '🔗'} {isAttach ? t('附件字段配置') : t('关联字段配置')} - {field.title}({field.name}){' '}
        <span style={{ color: '#999', fontWeight: 400, fontSize: 11 }}>
          {field.type}
          {field.target ? ` → ${field.target}` : ''}
        </span>
      </div>

      {isAttach && (
        <div style={row}>
          <span style={labelStyle}>
            📁 {t('附件文件夹')} <span style={{ color: '#ff4d4f' }}>*</span>{' '}
            <span style={{ color: '#999', fontWeight: 400 }}>（{t('从压缩包中选择，可重新选择其他文件夹')}）</span>
          </span>
          <Select
            size="small"
            style={{ minWidth: 200 }}
            placeholder={`- ${t('选文件夹')} -`}
            value={config.folder}
            onChange={(v) => set({ folder: v })}
            options={folders.map((f) => ({ value: f.name, label: `📁 ${f.name}（${f.fileCount}）` }))}
          />
        </div>
      )}

      <div style={row}>
        <span style={labelStyle}>
          {t('空值处理')} <span style={{ color: '#999', fontWeight: 400 }}>（{t('Excel 该字段为空时')}）</span>
        </span>
        <Radio.Group
          value={config.emptyStrategy || 'skip'}
          onChange={(e) => set({ emptyStrategy: e.target.value })}
          options={[
            { value: 'skip', label: `${t('跳过不更新')}（${isAttach ? t('保留原附件') : t('保留原值')}）` },
            { value: 'clear', label: `${t('清空该字段')}（${isAttach ? t('删除附件') : t('解除关联')}）` },
          ]}
        />
      </div>

      <div style={row}>
        <span style={labelStyle}>
          {t('匹配不到处理')}{' '}
          <span style={{ color: '#999', fontWeight: 400 }}>
            （{isAttach ? t('选中文件夹下找不到对应文件时') : t('填的主键值在关联表中不存在时')}）
          </span>
        </span>
        <Radio.Group
          value={config.notFound || 'fail'}
          onChange={(e) => set({ notFound: e.target.value })}
          options={[
            { value: 'fail', label: `${t('该行导入失败')}（${t('严格模式')}）` },
            {
              value: 'skip',
              label: `${isAttach ? t('跳过该附件') : t('跳过该字段')}（${
                isAttach ? t('单个文件跳过，其余正常导入') : t('多值任一匹配不到，整字段跳过')
              }）`,
            },
          ]}
        />
      </div>

      {showUpdateMode && (
        <div style={row}>
          <span style={labelStyle}>
            {t('更新模式')} <span style={{ color: '#999', fontWeight: 400 }}>（{t('仅 update/upsert 模式生效')}）</span>
          </span>
          <Radio.Group
            value={config.updateMode || 'overwrite'}
            onChange={(e) => set({ updateMode: e.target.value })}
            options={[
              {
                value: 'overwrite',
                label: `${t('覆盖更新')}（${isAttach ? t('替换所有附件') : t('全量替换原有关联')}）`,
              },
              {
                value: 'append',
                label: `${t('追加更新')}（${isAttach ? t('追加附件不删除原有') : t('追加关联不删除原有')}）`,
              },
            ]}
          />
        </div>
      )}

      {isM2o && isUpMode && (
        <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
          💡 {t('多对一为单值关联，更新时直接替换，无追加模式')}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#999' }}>
        💡{' '}
        {isAttach
          ? t('Excel 中填写文件名（如 photo.jpg），系统从选中的文件夹查找匹配；多个附件逗号分隔')
          : t('Excel 中填写目标表主键值（多对多逗号分隔，如 1,2,3）')}
      </div>
    </div>
  );
}
