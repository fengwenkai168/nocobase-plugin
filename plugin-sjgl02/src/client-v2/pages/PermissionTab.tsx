import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Select, Tag, Button, Space, Switch,
  Modal, Form, Input, message, Empty, Radio, Spin,
} from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { useAPIClient } from '@nocobase/client-v2';
import { NAMESPACE } from '../locale';

interface Target {
  id: string;
  nickname?: string;
  name?: string;
  title?: string;
  type: 'user' | 'role';
}

interface Permission {
  id?: number;
  targetType: string;
  targetId: string;
  targetName: string;
  tableName: string;
  canImport: boolean;
  canExport: boolean;
  importMode: string;
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
  exportFields: string[];
  exportFilter: Record<string, unknown> | null;
}

export default function PermissionTab() {
  const api = useAPIClient();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [viewScope, setViewScope] = useState('own');

  useEffect(() => {
    api.request({ url: 'sjgl02Permissions:settings', method: 'get' })
      .then((res: any) => {
        const s = res?.data?.data;
        if (s?.taskViewScope) setViewScope(s.taskViewScope);
      }).catch(() => {});
  }, [api]);

  const handleViewScopeChange = (val: string) => {
    setViewScope(val);
    api.request({ url: 'sjgl02Permissions:saveSettings', method: 'post', data: { taskViewScope: val } }).catch(() => {});
  };
  const [perms, setPerms] = useState<Permission[]>([]);
  const [editModal, setEditModal] = useState<{ open: boolean; perm?: Permission }>({ open: false });
  const [form] = Form.useForm();
  const [tableList, setTableList] = useState<Array<{ name: string; title: string }>>([]);
  const [searchText, setSearchText] = useState('');
  const [modalTableFields, setModalTableFields] = useState<string[]>([]);
  const [modalLoadingFields, setModalLoadingFields] = useState(false);

  useEffect(() => {
    api.request({ url: 'sjgl02Permissions:tables', method: 'get' })
      .then((res: any) => {
        const tables = res?.data?.data;
        if (Array.isArray(tables)) {
          setTableList(tables.map((item: any) => ({ name: item.name, title: item.title || item.name })));
        }
      }).catch(() => {});
  }, [api]);

  const { data: userRoleData, loading: loadingTargets } = useRequest(
    () => api.request({ url: 'sjgl02Permissions:userRoleList', method: 'get' }),
    { onError: () => {} },
  );

  const { loading: loadingPerms } = useRequest(
    () => api.request({
      url: 'sjgl02Permissions:get', method: 'get',
      params: { targetType: selectedTarget?.type, targetId: selectedTarget?.id },
    }),
    {
      refreshDeps: [selectedTarget],
      onSuccess: (res: any) => {
        const items = res?.data?.data;
        setPerms(Array.isArray(items) ? items : []);
      },
    },
  );

  const handleTogglePermission = async (tableName: string, field: 'canImport' | 'canExport') => {
    const updated = perms.map((p) =>
      p.tableName === tableName ? { ...p, [field]: !p[field] } : p,
    );
    setPerms(updated);
    try {
      await api.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: updated } });
    } catch { message.error(t('Save failed')); }
  };

  const handleDeletePermission = async (tableName: string) => {
    const updated = perms.filter((p) => p.tableName !== tableName);
    setPerms(updated);
    try {
      await api.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: updated } });
      message.success(t('Saved successfully'));
    } catch { message.error(t('Save failed')); }
  };

  const handleLoadTableFields = (tableName: string) => {
    if (!tableName) { setModalTableFields([]); return; }
    setModalLoadingFields(true);
    api.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName } })
      .then((res: any) => {
        const fields = res?.data?.data || [];
        setModalTableFields((Array.isArray(fields) ? fields : []).map((f: any) => f.name));
      }).catch(() => setModalTableFields([]))
      .finally(() => setModalLoadingFields(false));
  };

  const handleSavePermission = async () => {
    try {
      const values = await form.validateFields();
      let updatedPerms = [...perms];
      if (editModal.perm) {
        updatedPerms = updatedPerms.map((p) =>
          p.tableName === editModal.perm!.tableName ? { ...p, ...values } : p,
        );
      } else {
        updatedPerms.push({
          targetType: selectedTarget!.type,
          targetId: selectedTarget!.id,
          targetName: selectedTarget!.nickname || selectedTarget!.name || '',
          ...values,
          uniqueFields: values.uniqueFields || [],
          requiredFields: values.requiredFields || [],
          importFields: values.importFields || [],
          exportFields: values.exportFields || [],
          exportFilter: null,
        });
      }
      setPerms(updatedPerms);
      await api.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: updatedPerms } });
      message.success(t('Saved successfully'));
      setEditModal({ open: false });
    } catch { message.error(t('Save failed')); }
  };

  const targetList: Target[] = [
    ...((userRoleData as any)?.data?.data?.users || []).map((u: any) => ({ ...u, type: 'user' as const })),
    ...((userRoleData as any)?.data?.data?.roles || []).map((r: any) => ({
      id: r.id, nickname: r.title || r.name, type: 'role' as const,
    })),
  ];

  const filteredTargets = targetList.filter(t =>
    !searchText || (t.nickname || t.name || '').toLowerCase().includes(searchText.toLowerCase())
  );
  const userTargets = filteredTargets.filter(t => t.type === 'user');
  const roleTargets = filteredTargets.filter(t => t.type === 'role');

  const groupConfig = [
    { label: `👤 ${t('User')}`, items: userTargets, color: '#1677ff' },
    { label: `👥 ${t('Role')}`, items: roleTargets, color: '#52c41a' },
  ];

  return (
    <Row gutter={20}>
      <Col span={6}>
        <Card title={`${t('User')} / ${t('Role')}`} size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
          <Input.Search placeholder="搜索用户/角色" allowClear value={searchText}
            onChange={e => setSearchText(e.target.value)} style={{ marginBottom: 8 }} />
          {loadingTargets ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            : filteredTargets.length === 0 ? <Empty description="无匹配结果" />
            : groupConfig.filter(g => g.items.length > 0).map(group => (
              <div key={group.label}>
                <div style={{ fontSize: 11, color: '#999', padding: '8px 8px 4px', fontWeight: 600 }}>{group.label} ({group.items.length})</div>
                {group.items.map(item => (
                  <div key={`${item.type}-${item.id}`} onClick={() => setSelectedTarget(item)}
                    style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 2,
                      background: selectedTarget?.id === item.id && selectedTarget?.type === item.type ? '#e6f4ff' : undefined,
                      color: selectedTarget?.id === item.id && selectedTarget?.type === item.type ? '#1677ff' : undefined }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 600, background: item.type === 'user' ? '#1677ff' : '#52c41a' }}>{item.type === 'user' ? 'U' : 'R'}</div>
                    <span>{item.nickname || item.name || item.title}</span>
                  </div>
                ))}
              </div>
            ))}
        </Card>
      </Col>
      <Col span={18}>
        {!selectedTarget ? <Card><Empty description="请选择左侧用户或角色" /></Card> : (
          <div>
            <Card size="small" style={{ marginBottom: 12 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 600, background: selectedTarget.type === 'user' ? '#1677ff' : '#52c41a' }}>{selectedTarget.type === 'user' ? 'U' : 'R'}</div>
                  <strong>{selectedTarget.nickname || selectedTarget.name || selectedTarget.title}</strong>
                  <Tag color={selectedTarget.type === 'user' ? 'blue' : 'green'}>{selectedTarget.type === 'user' ? t('User') : t('Role')}</Tag>
                </Space>
                <Space>
                  <span style={{ fontSize: 12, color: '#666' }}>{t('Task view scope')}：</span>
                  <Radio.Group value={viewScope} onChange={(e) => handleViewScopeChange(e.target.value)} size="small">
                    <Radio.Button value="own">{t('View own only')}</Radio.Button>
                    <Radio.Button value="all">{t('View all')}</Radio.Button>
                  </Radio.Group>
                  <Button type="primary" size="small" onClick={() => { form.resetFields(); setEditModal({ open: true }); }}>+ {t('Add permission')}</Button>
                </Space>
              </Space>
            </Card>
            {loadingPerms ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              : perms.length === 0 ? <Card><Empty description={t('No permission configured')} /></Card>
              : perms.map((perm) => (
                <Card key={perm.tableName} size="small" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div><strong>{perm.tableName}</strong>
                      <Space style={{ marginLeft: 12 }}>
                        <Switch checkedChildren="导入" unCheckedChildren="关" checked={perm.canImport} onChange={() => handleTogglePermission(perm.tableName, 'canImport')} />
                        <Switch checkedChildren="导出" unCheckedChildren="关" checked={perm.canExport} onChange={() => handleTogglePermission(perm.tableName, 'canExport')} />
                      </Space>
                    </div>
                    <Space>
                      <Button size="small" type="link" onClick={() => { form.setFieldsValue(perm); handleLoadTableFields(perm.tableName); setEditModal({ open: true, perm }); }}>编辑</Button>
                      <Button size="small" type="link" danger onClick={() => handleDeletePermission(perm.tableName)}>删除</Button>
                    </Space>
                  </div>
                  <Space wrap>
                    <Tag color={perm.canImport ? 'blue' : 'default'}>导入: {perm.canImport ? '是' : '否'}</Tag>
                    <Tag color={perm.canExport ? 'green' : 'default'}>导出: {perm.canExport ? '是' : '否'}</Tag>
                    <Tag color="orange">导入模式: {perm.importMode}</Tag>
                    {perm.uniqueFields?.length > 0 && <Tag color="orange">唯一值: {perm.uniqueFields.join(',')}</Tag>}
                    {perm.requiredFields?.length > 0 && <Tag color="red">必填: {perm.requiredFields.join(',')}</Tag>}
                    <Tag color="cyan">可导入: {perm.importFields?.length === 0 ? '全部' : perm.importFields?.join(',')}</Tag>
                    <Tag color="purple">可导出: {perm.exportFields?.length === 0 ? '全部' : perm.exportFields?.join(',')}</Tag>
                  </Space>
                </Card>
              ))}
          </div>
        )}
      </Col>
      <Modal title={editModal.perm ? '编辑权限' : t('Add permission')} open={editModal.open}
        onCancel={() => setEditModal({ open: false })} onOk={handleSavePermission} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item label={t('Select table')} name="tableName" rules={[{ required: true }]}>
            <Select showSearch placeholder="选择数据表" onChange={val => handleLoadTableFields(val)}
              options={tableList.map(item => ({ value: item.name, label: `${item.title} (${item.name})` }))} />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Form.Item label={t('Allow import')} name="canImport" valuePropName="checked" noStyle><Switch /></Form.Item>
            <Form.Item label={t('Allow export')} name="canExport" valuePropName="checked" noStyle><Switch /></Form.Item>
          </Space>
          <Form.Item label={t('Import mode')} name="importMode">
            <Select options={[{ value: 'insert', label: '新增 (insert)' }, { value: 'update', label: '更新 (update)' }, { value: 'upsert', label: '新增+更新 (upsert)' }]} /></Form.Item>
          <Form.Item label="唯一值字段" name="uniqueFields">
            <Select mode="multiple" placeholder="选择唯一值字段" loading={modalLoadingFields}
              options={modalTableFields.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label="必填字段" name="requiredFields">
            <Select mode="multiple" placeholder="选择必填字段" loading={modalLoadingFields}
              options={modalTableFields.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label={t('Importable fields')} name="importFields">
            <Select mode="multiple" placeholder="空=全部允许" loading={modalLoadingFields}
              options={modalTableFields.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item label={t('Exportable fields')} name="exportFields">
            <Select mode="multiple" placeholder="空=全部允许" loading={modalLoadingFields}
              options={modalTableFields.map(v => ({ value: v, label: v }))} /></Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
