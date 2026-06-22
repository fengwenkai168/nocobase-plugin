import React, { useState } from 'react';
import {
  Card, Row, Col, Select, Tag, Button, Space, Switch,
  Modal, Form, Input, message, Empty, Radio, Alert, Spin,
} from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';

interface Target {
  id: number;
  nickname?: string;
  name?: string;
  title?: string;
  type: 'user' | 'role';
}

interface Permission {
  id?: number;
  targetType: string;
  targetId: number;
  targetName: string;
  tableName: string;
  canImport: boolean;
  canExport: boolean;
  importMode: string;
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
  exportFields: string[];
  exportFilter: any;
}

const MOCK_PERMISSIONS: Permission[] = [
  {
    targetType: 'role',
    targetId: 1,
    targetName: '管理员',
    tableName: 'users',
    canImport: true,
    canExport: true,
    importMode: 'insert',
    uniqueFields: [],
    requiredFields: ['手机号', '邮箱'],
    importFields: [],
    exportFields: [],
    exportFilter: null,
  },
  {
    targetType: 'role',
    targetId: 1,
    targetName: '管理员',
    tableName: 'orders',
    canImport: true,
    canExport: true,
    importMode: 'insert',
    uniqueFields: [],
    requiredFields: [],
    importFields: [],
    exportFields: [],
    exportFilter: null,
  },
];

export default function PermissionTab({ ctx }: { ctx: any }) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [viewScope, setViewScope] = useState('own');
  const [perms, setPerms] = useState<Permission[]>([]);
  const [editModal, setEditModal] = useState<{ open: boolean; perm?: Permission }>({ open: false });
  const [form] = Form.useForm();

  const { data: userRoleData, loading: loadingTargets } = useRequest(
    () => ctx.api.request({ url: 'sjgl02Permissions:userRoleList', method: 'get' }),
    {
      onSuccess: (res: any) => {
        if (!res?.data?.data) {
          const mockTargets = { users: [{ id: 1, nickname: '管理员', type: 'user' }], roles: [{ id: 1, name: 'admin', title: '管理员', type: 'role' }] };
          if (mockTargets) return;
        }
      },
    },
  );

  const { loading: loadingPerms } = useRequest(
    () => ctx.api.request({
      url: 'sjgl02Permissions:get',
      method: 'get',
      params: { targetType: selectedTarget?.type, targetId: selectedTarget?.id },
    }),
    {
      refreshDeps: [selectedTarget],
      onSuccess: (res) => {
        if (res?.data?.data?.length) {
          setPerms(res.data.data);
        } else {
          setPerms(selectedTarget?.type === 'role' && selectedTarget?.id === 1 ? MOCK_PERMISSIONS : []);
        }
      },
    },
  );

  const handleTogglePermission = (tableName: string, field: 'canImport' | 'canExport') => {
    setPerms((prev) =>
      prev.map((p) =>
        p.tableName === tableName ? { ...p, [field]: !p[field] } : p,
      ),
    );
  };

  const handleSavePermission = async () => {
    try {
      await ctx.api.request({
        url: 'sjgl02Permissions:save',
        method: 'post',
        data: { permissions: perms },
      });
      message.success(t('Saved successfully'));
      setEditModal({ open: false });
    } catch {
      message.error(t('Save failed'));
    }
  };

  const handleDeletePermission = (tableName: string) => {
    setPerms((prev) => prev.filter((p) => p.tableName !== tableName));
  };

  const targetList: Target[] = [
    ...(userRoleData?.data?.data?.users || []).map((u: any) => ({ ...u, type: 'user' as const })),
    ...(userRoleData?.data?.data?.roles || []).map((r: any) => ({
      id: r.id,
      nickname: r.title || r.name,
      type: 'role' as const,
    })),
  ];

  const defaultTargets: Target[] = [
    { id: 1, nickname: '管理员', type: 'role' },
    { id: 1, nickname: 'admin', type: 'user' },
  ];

  return (
    <Row gutter={20}>
      <Col span={6}>
        <Card
          title={t('User') + ' / ' + t('Role')}
          size="small"
          style={{ maxHeight: 500, overflow: 'auto' }}
        >
          {(targetList.length > 0 ? targetList : defaultTargets).map((target) => (
            <div
              key={`${target.type}-${target.id}`}
              onClick={() => setSelectedTarget(target)}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                marginBottom: 2,
                background: selectedTarget?.id === target.id && selectedTarget?.type === target.type ? '#e6f4ff' : undefined,
                color: selectedTarget?.id === target.id && selectedTarget?.type === target.type ? '#1677ff' : undefined,
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: '#fff',
                fontWeight: 600,
                background: target.type === 'user' ? '#1677ff' : '#52c41a',
              }}>
                {target.type === 'user' ? 'U' : 'R'}
              </div>
              <span>{target.nickname || target.name || target.title}</span>
            </div>
          ))}
        </Card>
      </Col>

      <Col span={18}>
        {!selectedTarget ? (
          <Card>
            <Empty description={t('No permission configured')} />
          </Card>
        ) : (
          <div>
            <Card size="small" style={{ marginBottom: 12 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#fff',
                    fontWeight: 600,
                    background: selectedTarget.type === 'user' ? '#1677ff' : '#52c41a',
                  }}>
                    {selectedTarget.type === 'user' ? 'U' : 'R'}
                  </div>
                  <strong>{selectedTarget.nickname || selectedTarget.name || selectedTarget.title}</strong>
                  <Tag color={selectedTarget.type === 'user' ? 'blue' : 'green'}>
                    {selectedTarget.type === 'user' ? t('User') : t('Role')}
                  </Tag>
                </Space>
                <Space>
                  <span style={{ fontSize: 12, color: '#666' }}>{t('Task view scope')}：</span>
                  <Radio.Group value={viewScope} onChange={(e) => setViewScope(e.target.value)} size="small">
                    <Radio.Button value="own">{t('View own only')}</Radio.Button>
                    <Radio.Button value="all">{t('View all')}</Radio.Button>
                  </Radio.Group>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => setEditModal({ open: true })}
                  >
                    + {t('Add permission')}
                  </Button>
                </Space>
              </Space>
            </Card>

            {perms.length === 0 ? (
              <Card>
                <Empty description={t('No permission configured')} />
              </Card>
            ) : (
              perms.map((perm) => (
                <Card
                  key={perm.tableName}
                  size="small"
                  style={{ marginBottom: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <strong>{perm.tableName}</strong>
                      <Space style={{ marginLeft: 12 }}>
                        <Switch
                          checkedChildren="导入"
                          unCheckedChildren="导入"
                          checked={perm.canImport}
                          onChange={() => handleTogglePermission(perm.tableName, 'canImport')}
                        />
                        <Switch
                          checkedChildren="导出"
                          unCheckedChildren="导出"
                          checked={perm.canExport}
                          onChange={() => handleTogglePermission(perm.tableName, 'canExport')}
                        />
                      </Space>
                    </div>
                    <Space>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => { form.setFieldsValue(perm); setEditModal({ open: true, perm }); }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="small"
                        type="link"
                        danger
                        onClick={() => handleDeletePermission(perm.tableName)}
                      >
                        删除
                      </Button>
                    </Space>
                  </div>
                  <Space wrap>
                    <Tag color={perm.canImport ? 'blue' : 'default'}>导入: {perm.canImport ? '是' : '否'}</Tag>
                    <Tag color={perm.canExport ? 'green' : 'default'}>导出: {perm.canExport ? '是' : '否'}</Tag>
                    <Tag color="orange">导入模式: {perm.importMode}</Tag>
                    {perm.uniqueFields?.length > 0 && (
                      <Tag color="orange">唯一值: {perm.uniqueFields.join(',')}</Tag>
                    )}
                    {perm.requiredFields?.length > 0 && (
                      <Tag color="red">必填: {perm.requiredFields.join(',')}</Tag>
                    )}
                    <Tag color="cyan">可导入: {perm.importFields?.length === 0 ? '全部' : perm.importFields?.join(',')}</Tag>
                    <Tag color="purple">可导出: {perm.exportFields?.length === 0 ? '全部' : perm.exportFields?.join(',')}</Tag>
                  </Space>
                </Card>
              ))
            )}
          </div>
        )}
      </Col>

      <Modal
        title={editModal.perm ? '编辑权限' : t('Add permission')}
        open={editModal.open}
        onCancel={() => setEditModal({ open: false })}
        onOk={handleSavePermission}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t('Select table')} name="tableName" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择数据表"
              options={[
                { value: 'users', label: '用户 (users)' },
                { value: 'roles', label: '角色 (roles)' },
                { value: 'orders', label: '订单 (orders)' },
                { value: 'products', label: '产品 (products)' },
                { value: 'posts', label: '文章 (posts)' },
              ]}
            />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Form.Item label={t('Allow import')} name="canImport" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
            <Form.Item label={t('Allow export')} name="canExport" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item label={t('Import mode')} name="importMode">
            <Select
              options={[
                { value: 'insert', label: '新增 (insert)' },
                { value: 'update', label: '更新 (update)' },
                { value: 'upsert', label: '新增+更新 (upsert)' },
              ]}
            />
          </Form.Item>
          <Form.Item label="唯一值字段" name="uniqueFields">
            <Select
              mode="multiple"
              placeholder="选择唯一值字段"
              options={[
                { value: '手机号', label: '手机号' },
                { value: '邮箱', label: '邮箱' },
                { value: '身份证号', label: '身份证号' },
              ]}
            />
          </Form.Item>
          <Form.Item label="必填字段" name="requiredFields">
            <Select
              mode="multiple"
              placeholder="选择必填字段"
              options={[
                { value: '姓名', label: '姓名' },
                { value: '手机号', label: '手机号' },
                { value: '邮箱', label: '邮箱' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('Importable fields')} name="importFields">
            <Select
              mode="multiple"
              placeholder="空=全部允许"
              options={[
                { value: '姓名', label: '姓名' },
                { value: '手机号', label: '手机号' },
                { value: '邮箱', label: '邮箱' },
                { value: '年龄', label: '年龄' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('Exportable fields')} name="exportFields">
            <Select
              mode="multiple"
              placeholder="空=全部允许"
              options={[
                { value: '姓名', label: '姓名' },
                { value: '手机号', label: '手机号' },
                { value: '邮箱', label: '邮箱' },
                { value: '年龄', label: '年龄' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
