import React, { useState } from 'react';
import {
  Card, Row, Col, Select, Tag, Button, Space, Switch, Checkbox, Popconfirm,
  Modal, Form, Input, message, Empty, Radio, Spin, Pagination, Alert, Table, Descriptions,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useAPI } from '../utils/api';
import { NAMESPACE } from '../locale';
import { useTargetList, useTableList, useViewScope, usePermissions, usePermissionFilter, useTableFields } from '../hooks';

export default function PermissionTab() {
  const api = useAPI();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [permSearch, setPermSearch] = useState('');
  const [editModal, setEditModal] = useState<{ open: boolean; perm?: any }>({ open: false });
  const [detailModal, setDetailModal] = useState<{ open: boolean; perm?: any }>({ open: false });
  const [form] = Form.useForm();
  const [formCanImport, setFormCanImport] = useState(true);
  const [formCanExport, setFormCanExport] = useState(true);
  const [formMode, setFormMode] = useState<string[]>(['insert']);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [subTab, setSubTab] = useState('perm');
  const [inheritedOpen, setInheritedOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [auditExpand, setAuditExpand] = useState<number[]>([]);

  const { targets, loading: loadingTargets } = useTargetList(api);
  const { tables } = useTableList(api);
  const { viewScope, setViewScope } = useViewScope(api);
  const { fields, loading: loadingFields, loadFields } = useTableFields(api);
  const {
    perms, inheritedPerms, customPerms,
    loading: loadingPerms, isSystemManaged,
    toggle, remove, save,
  } = usePermissions(api, selectedTarget);
  const filter = usePermissionFilter(perms, tables, permSearch, 10);

  const loadAuditLogs = () => {
    setLogLoading(true);
    api.request({ url: 'sjgl02_permission_logs:list', method: 'get', params: { sort: ['-createdAt'], pageSize: 50 } })
      .then((res: any) => {
        const rows = res?.data?.data?.rows || res?.data?.data || [];
        setAuditLogs(Array.isArray(rows) ? rows : []);
      }).catch(() => setAuditLogs([]))
      .finally(() => setLogLoading(false));
  };

  React.useEffect(() => { if (subTab === 'log') loadAuditLogs(); }, [subTab]);

  const userTargets = targets.filter((t: any) => t.type === 'user' && (!searchText || (t.nickname || '').toLowerCase().includes(searchText.toLowerCase())));
  const roleTargets = targets.filter((t: any) => t.type === 'role' && (!searchText || (t.nickname || '').toLowerCase().includes(searchText.toLowerCase())));

  const groupConfig = [
    { label: `👤 ${t('User')}`, items: userTargets, color: '#1677ff' },
    { label: `👥 ${t('Role')}`, items: roleTargets, color: '#52c41a' },
  ];

  const handleSave = async () => {
    try { const values = await form.validateFields(); const ok = await save(values, editModal.perm); if (ok) { message.success(t('Saved successfully')); setEditModal({ open: false }); } else message.error(t('Save failed')); }
    catch { message.error(t('Save failed')); }
  };

  const auditColumns = [
    { title: '时间', dataIndex: 'createdAt', width: 140, render: (v: any) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '操作人', dataIndex: 'operator', width: 80, render: (v: any) => v?.nickname || v?.username || '系统' },
    { title: '操作', dataIndex: 'action', width: 70, render: (v: string) => {
      const m: any = { create: <Tag color="green">创建</Tag>, update: <Tag color="orange">修改</Tag>, delete: <Tag color="red">删除</Tag>, toggle: <Tag color="blue">切换</Tag> };
      return m[v] || <Tag>{v}</Tag>;
    }},
    { title: '目标', dataIndex: 'targetName', width: 100 },
    { title: '数据表', dataIndex: 'tableName', width: 100 },
    { title: '变更概要', dataIndex: 'changes', render: (v: any) => v ? (v.after && !v.before ? '新增权限' : !v.after ? '移除权限' : '修改配置') : '—' },
  ];

  const renderCard = (perm: any) => (
    <Card key={perm.tableName + (perm._inherited ? '-i' : '')} size="small" style={{ marginBottom: 10, ...(perm._inherited ? { background: '#f9f9f9', opacity: 0.85 } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!perm._inherited && (
            <Checkbox checked={selectedRows.has(perm.tableName)} onChange={e => {
              const next = new Set(selectedRows); e.target.checked ? next.add(perm.tableName) : next.delete(perm.tableName); setSelectedRows(next);
            }} />
          )}
          <strong>{(tables.find((t: any) => t.name === perm.tableName)?.title || perm.tableName) + '(' + perm.tableName + ')'}</strong>
          {perm._systemManaged && <Tag color="blue" style={{ fontSize: 10 }}>系统管理</Tag>}
          {perm._inherited && !perm._systemManaged && <Tag color="purple" style={{ fontSize: 10 }}>继承</Tag>}
        </div>
        <Space>
          {perm._inherited ? (
            <Button size="small" type="link" onClick={() => setDetailModal({ open: true, perm })}>查看详情</Button>
          ) : (
            <>
              <Button size="small" type="link" onClick={() => { form.setFieldsValue(perm); loadFields(perm.tableName); setFormCanImport(perm.canImport !== false); setFormCanExport(perm.canExport !== false); setFormMode(Array.isArray(perm.importMode) ? perm.importMode : [perm.importMode || 'insert']); setEditModal({ open: true, perm }); }}>编辑</Button>
              <Button size="small" type="link" danger onClick={() => remove(perm.tableName)}>删除</Button>
            </>
          )}
        </Space>
      </div>
      <Space wrap size={[4, 4]}>
        <Tag color={perm.canImport ? 'blue' : 'default'}>导入: {perm.canImport ? '是' : '否'}</Tag>
        <Tag color={perm.canExport ? 'green' : 'default'}>导出: {perm.canExport ? '是' : '否'}</Tag>
        {perm.canImport && <>
          <Tag color="orange">导入模式: {(Array.isArray(perm.importMode) ? perm.importMode : [perm.importMode || 'insert']).map((m: string) => ({ insert: '新增', update: '更新', upsert: '新增+更新' })[m] || m).join(' / ')}</Tag>
          {perm.uniqueFields?.length > 0 && <Tag color="orange">唯一值: {perm.uniqueFields.join(', ')}</Tag>}
          {perm.requiredFields?.length > 0 && <Tag color="red">必填: {perm.requiredFields.join(', ')}</Tag>}
        </>}
        {perm.canImport && <Tag color="cyan">可导入: {perm.importFields?.length > 0 ? perm.importFields.length + '个字段' : '全部'}</Tag>}
        {perm.canExport && <Tag color="purple">可导出: {perm.exportFields?.length > 0 ? perm.exportFields.length + '个字段' : '全部'}</Tag>}
      </Space>
    </Card>
  );

  return (
    <div>
      <Row gutter={20}>
        <Col span={6}>
          <Card title={`${t('User')} / ${t('Role')}`} size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
            <Input.Search placeholder="搜索用户/角色" allowClear value={searchText} onChange={e => setSearchText(e.target.value)} style={{ marginBottom: 8 }} />
            {loadingTargets ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
              : groupConfig.filter(g => g.items.length > 0).map(group => (
                <div key={group.label}>
                  <div style={{ fontSize: 11, color: '#999', padding: '8px 8px 4px', fontWeight: 600 }}>{group.label} ({group.items.length})</div>
                  {group.items.map((item: any) => (
                    <div key={`${item.type}-${item.id}`} onClick={() => { setSelectedTarget(item); setSelectedRows(new Set()); }}
                      style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 2,
                        background: selectedTarget?.id === item.id && selectedTarget?.type === item.type ? '#e6f4ff' : undefined,
                        color: selectedTarget?.id === item.id && selectedTarget?.type === item.type ? '#1677ff' : undefined }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 600, background: item.type === 'user' ? '#1677ff' : '#52c41a' }}>{item.type === 'user' ? 'U' : 'R'}</div>
                      <div>
                        <div>{item.type === 'role' && item.name ? `${item.nickname || item.name}（${item.name}）` : (item.nickname || item.name || item.title)}</div>
                        {item.type === 'user' && item.roles?.length > 0 && (
                          <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                            {item.roles.map((r: any) => `${r.title || r.name}（${r.name}）`).join(' · ')}
                          </div>
                        )}
                      </div>
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
                    <strong>{selectedTarget.type === 'role' && selectedTarget.name ? `${selectedTarget.nickname || selectedTarget.name || selectedTarget.title}（${selectedTarget.name}）` : (selectedTarget.nickname || selectedTarget.name || selectedTarget.title)}</strong>
                    <Tag color={selectedTarget.type === 'user' ? 'blue' : 'green'}>{selectedTarget.type === 'user' ? t('User') : t('Role')}</Tag>
                    {selectedTarget.type === 'user' && selectedTarget.roles?.length > 0 && (
                      <>
                        <span style={{ fontSize: 11, color: '#999' }}>角色：</span>
                        {selectedTarget.roles.map((r: any, i: number) => <Tag key={i} color={i === 0 ? 'green' : 'orange'} style={{ fontSize: 10 }}>{r.title || r.name}（{r.name}）</Tag>)}
                      </>
                    )}
                  </Space>
                  <Space>
                    {selectedTarget?.type === 'user' && (<>
                      <span style={{ fontSize: 12, color: '#666' }}>{t('Task view scope')}：</span>
                      <Radio.Group value={viewScope} onChange={(e) => setViewScope(e.target.value)} size="small">
                        <Radio.Button value="own">{t('View own only')}</Radio.Button>
                        <Radio.Button value="all">{t('View all')}</Radio.Button>
                      </Radio.Group>
                    </>)}
                    {!isSystemManaged && <Button type="primary" size="small" onClick={() => { form.resetFields(); setEditModal({ open: true }); setFormCanImport(false); setFormCanExport(false); setFormMode(['insert']); }}>+ {t('Add permission')}</Button>}
                  </Space>
                </Space>
              </Card>

              <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0', marginBottom: 12 }}>
                <div onClick={() => setSubTab('perm')} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, borderBottom: subTab === 'perm' ? '2px solid #1677ff' : '2px solid transparent', color: subTab === 'perm' ? '#1677ff' : '#999', fontWeight: subTab === 'perm' ? 600 : 400, marginBottom: -2 }}>✓ 权限配置</div>
                <div onClick={() => setSubTab('log')} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, borderBottom: subTab === 'log' ? '2px solid #1677ff' : '2px solid transparent', color: subTab === 'log' ? '#1677ff' : '#999', fontWeight: subTab === 'log' ? 600 : 400, marginBottom: -2 }}>📋 操作日志</div>
              </div>

              {subTab === 'log' ? (
                <Table columns={auditColumns} dataSource={auditLogs} rowKey="id" size="small" loading={logLoading}
                  pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: '暂无操作日志' }}
                  expandable={{
                    expandedRowRender: (record: any) => (
                      <div style={{ fontSize: 12, color: '#555', padding: 8 }}>
                        <b>变更详情：</b><br/>
                        {record.changes?.before && <><span style={{ color: '#999' }}>操作前：</span>{JSON.stringify(record.changes.before).substring(0, 300)}<br/></>}
                        {record.changes?.after && <><span style={{ color: '#52c41a' }}>操作后：</span>{JSON.stringify(record.changes.after).substring(0, 300)}</>}
                        {!record.changes?.after && record.changes?.before && <><span style={{ color: '#ff4d4f' }}>操作结果：</span>已删除</>}
                      </div>
                    ),
                  }}
                />
              ) : (
                <div>
                  {selectedTarget?.type === 'role' && isSystemManaged && (
                    <Alert type="info" showIcon message="管理员/超级管理员角色拥有全部数据表权限，不可修改" style={{ marginBottom: 12 }} />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {!isSystemManaged && customPerms.length > 0 && (
                      <>
                        <Checkbox checked={selectedRows.size > 0 && selectedRows.size === customPerms.length}
                          indeterminate={selectedRows.size > 0 && selectedRows.size < customPerms.length}
                          onChange={e => e.target.checked ? setSelectedRows(new Set(customPerms.map((p: any) => p.tableName))) : setSelectedRows(new Set())} />
                        <span style={{ fontSize: 12, color: '#666' }}>全选</span>
                        {selectedRows.size > 0 && (
                          <Popconfirm title={`确认删除选中的 ${selectedRows.size} 条权限？`} onConfirm={() => { selectedRows.forEach(n => remove(n)); setSelectedRows(new Set()); message.success('批量删除成功'); }} okText="确认" cancelText="取消">
                            <Button size="small" danger>批量删除 ({selectedRows.size})</Button>
                          </Popconfirm>
                        )}
                      </>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <Input.Search placeholder="搜索表名或表标识" allowClear size="small" style={{ width: 200 }}
                        value={permSearch} onChange={v => setPermSearch(v.target.value)} />
                    </div>
                  </div>

                  {loadingPerms ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                    : filter.isEmpty ? <Empty description={t('No permission configured')} />
                    : (
                      <>
                        {(() => {
                          const visibleItems = [
                            ...(inheritedOpen ? filter.inheritedPerms : []),
                            ...(customOpen ? filter.customPerms : []),
                          ];
                          const visTotal = visibleItems.length;
                          const safePage = Math.min(filter.page, Math.max(1, Math.ceil(visTotal / 10)));
                          const pagedVis = visibleItems.slice((safePage - 1) * 10, safePage * 10);
                          const pagedInh = pagedVis.filter((p: any) => p._inherited);
                          const pagedCus = pagedVis.filter((p: any) => !p._inherited);
                          return (
                            <>
                              {filter.inheritedPerms.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                  <div onClick={() => { setInheritedOpen(!inheritedOpen); filter.setPage(1); }} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#999', marginBottom: 6, userSelect: 'none' }}>
                                    <span style={{ marginRight: 4, fontSize: 11 }}>{inheritedOpen ? '▼' : '▶'}</span> 📦 角色继承的权限（{filter.inheritedPerms.length}条）
                                  </div>
                                  {inheritedOpen && pagedInh.map(renderCard)}
                                </div>
                              )}
                              {filter.customPerms.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                  <div onClick={() => { setCustomOpen(!customOpen); filter.setPage(1); }} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 6, userSelect: 'none' }}>
                                    <span style={{ marginRight: 4, fontSize: 11 }}>{customOpen ? '▼' : '▶'}</span> ✏️ 用户自定义权限（{filter.customPerms.length}条）
                                  </div>
                                  {customOpen && pagedCus.map(renderCard)}
                                </div>
                              )}
                              {visTotal > 10 && <div style={{ textAlign: 'center', marginTop: 8 }}><Pagination size="small" current={safePage} total={visTotal} pageSize={10} onChange={filter.setPage} /></div>}
                            </>
                          );
                        })()}
                      </>
                    )}
                </div>
              )}
            </div>
          )}
        </Col>
      </Row>

      {/* 编辑弹窗 */}
      <Modal title={editModal.perm ? '编辑权限' : t('Add permission')} open={editModal.open} onCancel={() => setEditModal({ open: false })} onOk={handleSave} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item label={t('Select table')} name="tableName" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择数据表"
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              onChange={(val: string) => loadFields(val)}
              options={tables.filter((t: any) => { if (editModal.perm && editModal.perm.tableName === t.name) return true; return !perms.some((p: any) => p.tableName === t.name && !p._inherited); }).map((item: any) => ({ value: item.name, label: `${item.title} (${item.name})` }))} />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Form.Item label={t('Allow import')} name="canImport" valuePropName="checked" noStyle>
              <Switch onChange={v => { setFormCanImport(v); if (!v) setFormMode([]); }} /></Form.Item>
            <Form.Item label={t('Allow export')} name="canExport" valuePropName="checked" noStyle>
              <Switch onChange={v => setFormCanExport(v)} /></Form.Item>
          </Space>
          {formCanImport && (
            <>
              <Form.Item label={`${t('Import mode')}（可多选）`} name="importMode" rules={[{ required: true, message: '请选择导入模式' }]}>
                <Select mode="multiple" onChange={v => setFormMode(v || [])} options={[{ value: 'insert', label: '新增(insert)' }, { value: 'update', label: '更新(update)' }, { value: 'upsert', label: '新增+更新(upsert)' }]} /></Form.Item>
              {formMode.some(m => m === 'update' || m === 'upsert') && (
                <Form.Item label="唯一值字段" name="uniqueFields" rules={[{ required: true, message: '更新/新增+更新模式必须配置唯一值字段' }]}>
                  <Select mode="multiple" showSearch placeholder="选择唯一值字段" loading={loadingFields} filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())} options={fields.map(v => ({ value: v.name, label: v.label }))} /></Form.Item>
              )}
              <Form.Item label="必填字段" name="requiredFields">
                <Select mode="multiple" showSearch placeholder="选择必填字段" loading={loadingFields} filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())} options={fields.map(v => ({ value: v.name, label: v.label }))} /></Form.Item>
              <Form.Item label={t('Importable fields')} name="importFields">
                <Select mode="multiple" showSearch placeholder="空=全部允许" loading={loadingFields} filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())} options={fields.map(v => ({ value: v.name, label: v.label }))} /></Form.Item>
            </>
          )}
          {formCanExport && (
            <Form.Item label={t('Exportable fields')} name="exportFields">
              <Select mode="multiple" showSearch placeholder="空=全部允许" loading={loadingFields} filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())} options={fields.map(v => ({ value: v.name, label: v.label }))} /></Form.Item>
          )}
        </Form>
      </Modal>

      {/* 查看详情弹窗（只读） */}
      <Modal title="📋 查看权限详情" open={detailModal.open} onCancel={() => setDetailModal({ open: false })} footer={<Button onClick={() => setDetailModal({ open: false })}>{t('Close')}</Button>} width={680}>
        {detailModal.perm && (
          <div>
            <Alert type="info" showIcon message="此权限为继承权限，不可在此编辑。" style={{ marginBottom: 12 }} />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="数据表"><b>{detailModal.perm.tableName}</b></Descriptions.Item>
              <Descriptions.Item label="允许导入">{detailModal.perm.canImport ? <Tag color="blue">是</Tag> : <Tag>否</Tag>}</Descriptions.Item>
              <Descriptions.Item label="允许导出">{detailModal.perm.canExport ? <Tag color="blue">是</Tag> : <Tag>否</Tag>}</Descriptions.Item>
              <Descriptions.Item label="导入模式">{(Array.isArray(detailModal.perm.importMode) ? detailModal.perm.importMode : [detailModal.perm.importMode || 'insert']).map((m: string) => <Tag key={m} color="orange">{(m === 'insert' ? '新增' : m === 'update' ? '更新' : '新增+更新')}</Tag>)}</Descriptions.Item>
              <Descriptions.Item label="唯一值字段">{detailModal.perm.uniqueFields?.length > 0 ? detailModal.perm.uniqueFields.join(', ') : '—'}</Descriptions.Item>
              <Descriptions.Item label="必填字段">{detailModal.perm.requiredFields?.length > 0 ? detailModal.perm.requiredFields.join(', ') : '—'}</Descriptions.Item>
              <Descriptions.Item label="可导入字段">{detailModal.perm.importFields?.length > 0 ? detailModal.perm.importFields.join(', ') : '全部字段允许'}</Descriptions.Item>
              <Descriptions.Item label="可导出字段">{detailModal.perm.exportFields?.length > 0 ? detailModal.perm.exportFields.join(', ') : '全部字段允许'}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
