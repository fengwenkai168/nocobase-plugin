import React, { useEffect, useState } from 'react';
import { Button, List, Modal, Spin, Tag } from 'antd';
import { CopyOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { FieldMetaInfo, useApi } from '../../services/api';
import { fieldLabel } from '../import-wizard/field-utils';

interface ExportScheme {
  id: number;
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  exportFields: string[];
}

export default function ExportSchemeModal({
  open,
  collectionName,
  fields,
  selectedFields,
  onClose,
  onApply,
}: {
  open: boolean;
  collectionName: string;
  fields: FieldMetaInfo[];
  selectedFields: string[];
  onClose: () => void;
  onApply: (scheme: ExportScheme) => void;
}) {
  const t = useT();
  const api = useApi();
  const [schemes, setSchemes] = useState<ExportScheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !collectionName) return;
    setLoading(true);
    setError(null);
    api
      .listExportSchemes(collectionName)
      .then((res) => {
        setSchemes(res.schemes || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
        return undefined;
      });
  }, [open, collectionName, api]);

  const apply = (scheme: ExportScheme) => {
    onApply(scheme);
    onClose();
  };

  return (
    <Modal
      title={
        <span>
          <CopyOutlined /> {t('复用其他方案的字段排序')}
        </span>
      }
      open={open}
      width={560}
      footer={<Button onClick={onClose}>{t('关闭')}</Button>}
      onCancel={onClose}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : error ? (
        <div style={{ color: '#ff4d4f', padding: 12 }}>{error}</div>
      ) : schemes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>{t('该数据表暂无其他权限方案')}</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
            {t('选择任一方案，将当前已勾选字段按该方案的顺序重排（仅复用顺序，不改变勾选集合；无权限的字段不会出现）')}
          </div>
          <List
            size="small"
            dataSource={schemes}
            renderItem={(scheme) => {
              const orderable = scheme.exportFields.filter((f) => selectedFields.includes(f));
              const rest = selectedFields.filter((f) => !scheme.exportFields.includes(f));
              const preview = [...orderable, ...rest].slice(0, 4);
              const previewMore = [...orderable, ...rest].length - preview.length;
              return (
                <List.Item
                  actions={[
                    <Button
                      key="apply"
                      size="small"
                      type="primary"
                      disabled={orderable.length === 0}
                      onClick={() => apply(scheme)}
                    >
                      {t('应用')}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      scheme.targetType === 'user' ? (
                        <UserOutlined style={{ color: '#1677ff' }} />
                      ) : (
                        <TeamOutlined style={{ color: '#52c41a' }} />
                      )
                    }
                    title={
                      <span>
                        {scheme.targetName}
                        <Tag style={{ marginLeft: 8 }} color={scheme.targetType === 'user' ? 'blue' : 'green'}>
                          {scheme.targetType === 'user' ? t('用户') : t('角色')}
                        </Tag>
                        <Tag color="cyan">
                          {scheme.exportFields.length} {t('个字段')}
                        </Tag>
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 12 }}>
                        {preview.length ? (
                          <>
                            {preview.map((f) => fieldLabel(f, fields)).join(' → ')}
                            {previewMore > 0 && ` … (+${previewMore})`}
                          </>
                        ) : (
                          t('无可用字段')
                        )}
                      </span>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </>
      )}
    </Modal>
  );
}
