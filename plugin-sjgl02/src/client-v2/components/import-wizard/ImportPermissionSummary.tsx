import React from 'react';
import { Collapse, Tag } from 'antd';
import { ArrowDownOutlined, CheckOutlined, EditOutlined, FileTextOutlined, KeyOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { FieldMetaInfo, PermConfigInfo } from '../../services/api';
import { modeLabel } from './modeLabels';
import { fieldLabel } from './field-utils';

export default function ImportPermissionSummary({
  permission,
  fields,
}: {
  permission: PermConfigInfo;
  fields: FieldMetaInfo[];
}) {
  const t = useT();
  return (
    <Collapse
      size="small"
      style={{ marginTop: 12 }}
      items={[
        {
          key: '1',
          label: (
            <span style={{ fontSize: 12 }}>
              {permission.targetType === 'user' ? '👤' : '🔐'} {permission.targetName}
              {'（'}
              {t('模式')}: {permission.importModes.map((m) => modeLabel(t, m)).join('/')}
              {'）'}
            </span>
          ),
          children: (
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              <div>
                <strong style={{ color: '#333' }}>
                  <FileTextOutlined /> {t('类型')}：
                </strong>
                <Tag color={permission.targetType === 'user' ? 'blue' : 'green'}>
                  {permission.targetType === 'user' ? t('用户') : t('角色')}
                </Tag>
                <strong>{permission.targetName}</strong>
              </div>
              <div>
                <strong style={{ color: '#333' }}>
                  <ArrowDownOutlined /> {t('导入模式')}：
                </strong>
                {permission.importModes.map((m) => (
                  <Tag key={m} color="blue">
                    {modeLabel(t, m)}
                  </Tag>
                ))}
                {permission.importModes.length <= 1 && <Tag>🔒 {t('只读（权限限定唯一模式）')}</Tag>}
              </div>
              <div>
                <strong style={{ color: '#333' }}>
                  <KeyOutlined /> {t('唯一值')}：
                </strong>
                {permission.uniqueFields.length ? (
                  <>
                    {permission.uniqueFields.map((f) => (
                      <Tag key={f} color="orange">
                        {fieldLabel(f, fields)}
                      </Tag>
                    ))}
                    <Tag>🔒 {t('由权限锁定')}</Tag>
                  </>
                ) : (
                  <Tag color="green">
                    <EditOutlined /> {t('自由选择')}
                  </Tag>
                )}
              </div>
              <div>
                <strong style={{ color: '#333' }}>❗ {t('必填字段')}：</strong>
                {permission.requiredFields.length ? (
                  permission.requiredFields.map((f) => (
                    <Tag key={f} color="red">
                      {fieldLabel(f, fields)}
                    </Tag>
                  ))
                ) : (
                  <span style={{ color: '#999' }}>{t('无')}</span>
                )}
              </div>
              <div>
                <strong style={{ color: '#333' }}>
                  <CheckOutlined /> {t('可导入字段')}：
                </strong>
                {permission.importFields.length ? (
                  <>
                    {permission.importFields.map((f) => (
                      <Tag key={f} color="blue">
                        {fieldLabel(f, fields)}
                      </Tag>
                    ))}
                    <span style={{ color: '#999', fontSize: 11 }}>
                      （{t('共{{count}}个字段', { count: permission.importFields.length })}）
                    </span>
                  </>
                ) : (
                  <Tag color="green">{t('全部字段允许（未限制）')}</Tag>
                )}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
