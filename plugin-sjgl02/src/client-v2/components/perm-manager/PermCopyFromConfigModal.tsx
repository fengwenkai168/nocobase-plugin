import React, { useEffect, useState } from 'react';
import { App, Button, Modal, Select } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { useApi } from '../../services/api';

interface PermListByCollectionItem {
  id: number;
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  importFields: string[];
  exportFields: string[];
}

export default function CopyFromConfigModal({
  open,
  collectionName,
  fieldOptions,
  onClose,
  onCopy,
}: {
  open: boolean;
  collectionName: string;
  fieldOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onCopy: (fields: string[]) => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [list, setList] = useState<PermListByCollectionItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && collectionName) {
      setLoading(true);
      api
        .permListByCollection(collectionName)
        .then((res) => {
          setList(res.list);
          setLoading(false);
        })
        .catch(() => {
          setList([]);
          setLoading(false);
        });
    }
  }, [open, collectionName, api]);

  const selected = list.find((x) => x.id === selectedId);
  const validFields = (fields: string[]) => fields.filter((f) => fieldOptions.some((o) => o.value === f));
  const labelOf = (v: string) => fieldOptions.find((o) => o.value === v)?.label || v;

  const handleCopy = () => {
    if (!selected) return;
    const source = selected.importFields.length ? selected.importFields : selected.exportFields;
    const valid = validFields(source);
    if (!valid.length) {
      message.warning(t('该配置中没有当前表可用的字段'));
      return;
    }
    onCopy(valid);
    onClose();
  };

  return (
    <Modal
      title={
        <span>
          <FileTextOutlined /> {t('从其他配置复制')}
        </span>
      }
      open={open}
      width={560}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button type="primary" disabled={!selectedId} onClick={handleCopy}>
            {t('确认复制')}
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{t('选择源配置')}</div>
        <Select
          style={{ width: '100%' }}
          loading={loading}
          placeholder={t('选择其他用户/角色的权限配置')}
          value={selectedId}
          onChange={setSelectedId}
          options={list.map((x) => ({
            value: x.id,
            label: `${x.targetType === 'user' ? '👤' : '🔐'} ${x.targetName}（导入${x.importFields.length}字段/导出${
              x.exportFields.length
            }字段）`,
          }))}
          showSearch
          optionFilterProp="label"
        />
      </div>
      {selected && (
        <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
            {selected.targetType === 'user' ? '👤' : '🔐'} {selected.targetName}
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <strong>
              导入字段（{validFields(selected.importFields).length}/{selected.importFields.length}）：
            </strong>
            {validFields(selected.importFields).length
              ? validFields(selected.importFields).map(labelOf).join('、')
              : t('无')}
          </div>
          <div style={{ fontSize: 12 }}>
            <strong>
              导出字段（{validFields(selected.exportFields).length}/{selected.exportFields.length}）：
            </strong>
            {validFields(selected.exportFields).length
              ? validFields(selected.exportFields).map(labelOf).join('、')
              : t('无')}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
        ℹ️ {t('仅显示有当前表权限配置的用户/角色，源字段在当前表不存在的将自动跳过')}
      </div>
    </Modal>
  );
}
