import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Modal, Select, Space, Tabs, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { PermRecord, useApi } from '../../services/api';
import TargetSidebar, { PermTarget } from './TargetSidebar';
import PermCardList from './PermCardList';
import PermEditModal from './PermEditModal';
import PermLogTable from './PermLogTable';

const ADMIN_ROLES = ['admin', 'root'];

export default function PermManager() {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [target, setTarget] = useState<PermTarget | undefined>();
  const [own, setOwn] = useState<PermRecord[]>([]);
  const [inherited, setInherited] = useState<
    Array<{ roleName: string; roleTitle: string; items: PermRecord[]; isAdmin: boolean }>
  >([]);
  const [subTab, setSubTab] = useState('perm');
  const [editRecord, setEditRecord] = useState<PermRecord | null | undefined>(undefined);
  const [scope, setScope] = useState<'self' | 'all'>('self');
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdminRoleTarget = target?.type === 'role' && ADMIN_ROLES.includes(target.id);

  const load = useCallback(async () => {
    if (!target) return;
    const res = await api.getPermList(target.type, target.id);
    setOwn(res.own);
    setInherited(res.inherited);
    if (target.type === 'user') {
      const scopeRes = await api.getScope(Number(target.id));
      setScope(scopeRes.scope);
    }
  }, [api, target]);

  useEffect(() => {
    setSubTab('perm');
    load();
  }, [load]);

  const onDelete = (record: PermRecord) => {
    Modal.confirm({
      title: (
        <span>
          <DeleteOutlined /> {t('确认删除')}
        </span>
      ),
      content: (
        <>
          {t('确认删除')}{' '}
          <strong>
            {record.collectionTitle || record.collectionName}({record.collectionName})
          </strong>{' '}
          {t('的权限配置？')}
          <br />
          <span style={{ color: '#999' }}>{t('此操作不可撤销。')}</span>
        </>
      ),
      okButtonProps: { danger: true },
      okText: t('确认删除'),
      cancelText: t('取消'),
      onOk: async () => {
        await api.destroyPermission(record.id);
        message.success(t('权限配置已删除'));
        load();
      },
    });
  };

  const onScopeChange = async (v: 'self' | 'all') => {
    if (!target) return;
    await api.setScope(Number(target.id), v);
    setScope(v);
    message.success(`${t('任务查看范围已更新为')}：${v === 'all' ? t('查看全部') : t('仅查看自己的')}`);
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <TargetSidebar selected={target} onSelect={setTarget} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {target?.type === 'user' ? '👤' : '🔐'} {target?.name} {t('的权限配置')}{' '}
            <Tag color={target?.type === 'user' ? 'blue' : 'green'}>
              {target?.type === 'user' ? t('用户') : t('角色')}
            </Tag>
          </span>
          <Space>
            {target?.type === 'user' && (
              <>
                <span style={{ color: '#999', fontSize: 12 }}>{t('任务查看范围')}：</span>
                <Select
                  size="small"
                  style={{ width: 140 }}
                  value={scope}
                  onChange={onScopeChange}
                  options={[
                    { value: 'self', label: t('仅查看自己的') },
                    { value: 'all', label: t('查看全部') },
                  ]}
                />
              </>
            )}
            {!isAdminRoleTarget && target && (
              <Button type="primary" size="small" onClick={() => setEditRecord(null)}>
                + {t('添加权限配置')}
              </Button>
            )}
          </Space>
        </div>

        <Tabs
          activeKey={subTab}
          onChange={setSubTab}
          items={[
            { key: 'perm', label: `✓ ${t('权限配置')}` },
            {
              key: 'logs',
              label: (
                <span>
                  <FileTextOutlined /> {t('操作日志')}
                </span>
              ),
            },
          ]}
        />

        {subTab === 'perm' &&
          (isAdminRoleTarget ? (
            <Alert
              type="error"
              showIcon
              message={<strong style={{ fontSize: 14 }}>{t('此角色拥有全部权限，无需配置')}</strong>}
              description={
                <>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    {t(
                      'admin/root 角色自动拥有所有数据表的导入、导出、全部模式、全部字段权限，包括系统表导出权限。不可修改、不可删除。',
                    )}
                  </div>
                  <Space size={8} wrap>
                    <Tag color="blue">
                      <CheckOutlined /> {t('导入')}: {t('全部数据表')}
                    </Tag>
                    <Tag color="green">
                      <CheckOutlined /> {t('导出')}: {t('全部数据表（含系统表）')}
                    </Tag>
                    <Tag color="orange">
                      <CheckOutlined /> {t('模式')}: {t('新增/更新/新增+更新')}
                    </Tag>
                    <Tag color="cyan">
                      <CheckOutlined /> {t('可导入')}: {t('全部字段')}
                    </Tag>
                    <Tag color="purple">
                      <CheckOutlined /> {t('可导出')}: {t('全部字段')}
                    </Tag>
                    <Tag color="red">
                      <CheckOutlined /> {t('任务管理')}: {t('查看全部')}
                    </Tag>
                    <Tag>
                      <CheckOutlined /> {t('权限管理')}
                    </Tag>
                  </Space>
                </>
              }
            />
          ) : (
            target && (
              <PermCardList
                own={own}
                inherited={inherited}
                isUser={target.type === 'user'}
                onEdit={(record) => setEditRecord(record ?? null)}
                onDelete={onDelete}
                refreshKey={refreshKey}
              />
            )
          ))}

        {subTab === 'logs' && target && <PermLogTable targetType={target.type} targetId={target.id} />}
      </div>

      {editRecord !== undefined && target && (
        <PermEditModal
          target={target}
          record={editRecord}
          existingCollections={own.map((r) => r.collectionName)}
          onClose={() => setEditRecord(undefined)}
          onSaved={() => {
            setEditRecord(undefined);
            setRefreshKey((k) => k + 1);
            load();
          }}
        />
      )}
    </div>
  );
}
