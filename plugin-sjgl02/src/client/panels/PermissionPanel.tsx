// @ts-nocheck
import React from 'react';
import { useAPIClient } from '@nocobase/client';
import { Card, Button, Space, Select, Tag, Row, Col, Input, message, Checkbox, Switch, Empty, Modal, Form, Radio, Pagination, Alert, Table, Descriptions, Popconfirm } from 'antd';
import { apiRequest } from './shared';

export default function PermissionPanel() {
  const client = useAPIClient();
  const [targets, setTargets] = React.useState<any[]>([]);
  const [selTarget, setSelTarget] = React.useState<any>(null);
  const [perms, setPerms] = React.useState<any[]>([]);
  const [viewScope, setViewScope] = React.useState('all');
  const [modal, setModal] = React.useState<any>({ open: false });
  const [detailModal, setDetailModal] = React.useState<any>({ open: false, perm: null });
  const [form] = Form.useForm();
  const [tables, setTables] = React.useState<any[]>([]);
  const [modalFields, setModalFields] = React.useState<{ name: string; label: string }[]>([]);
  const [targetSearch, setTargetSearch] = React.useState('');
  const [permSearch, setPermSearch] = React.useState('');
  const [permPage, setPermPage] = React.useState(1);
  const [formCanImport, setFormCanImport] = React.useState(true);
  const [formCanExport, setFormCanExport] = React.useState(true);
  const [formMode, setFormMode] = React.useState<string[]>(['insert']);
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  const [subTab, setSubTab] = React.useState('perm');
  const [inheritedOpen, setInheritedOpen] = React.useState(true);
  const [customOpen, setCustomOpen] = React.useState(true);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const [logLoading, setLogLoading] = React.useState(false);
  const [logFilter, setLogFilter] = React.useState('all');
  const [logPage, setLogPage] = React.useState(1);

  const savingRef = React.useRef(false);
  const savePermsRef = React.useRef(false);

  React.useEffect(() => {
    apiRequest(client, 'sjgl02Permissions:userRoleList').then((data) => {
      if (data) {
        const users = (data.users || []).map((u: any) => ({ ...u, type: 'user' }));
        const roles = (data.roles || []).map((r: any) => ({ id: String(r.id || ''), nickname: r.title || r.name, name: r.name, type: 'role' })).filter((r: any) => r.id);
        setTargets([...users, ...roles]);
      }
    }).catch(() => {});
    apiRequest(client, 'sjgl02Permissions:tables').then((data) => {
      if (Array.isArray(data)) setTables(data.map((t: any) => ({ name: t.name, title: t.title || t.name })));
    }).catch(() => {});
    apiRequest(client, 'sjgl02Permissions:settings').then((data) => {
      if (data?.taskViewScope) setViewScope(data.taskViewScope);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (selTarget) {
      client.request({ url: 'sjgl02Permissions:get', method: 'get', params: { targetType: selTarget.type, targetId: selTarget.id } })
        .then((res: any) => {
          const d = res?.data?.data || {};
          const custom = (d.custom || []).map((p: any) => ({ ...p, _inherited: p._inherited ?? false }));
          const inherited = (d.inherited || []).map((p: any) => ({ ...p, _inherited: true }));
          const seen = new Set<string>();
          const uniqueInherited = inherited.filter((p: any) => { if (seen.has(p.tableName)) return false; seen.add(p.tableName); return true; });
          setPerms([...custom, ...uniqueInherited]);
          setSelectedRows(new Set());
        }).catch(() => setPerms([]));
    }
    if (selTarget?.type === 'user') {
      client.request({ url: 'sjgl02Permissions:settings', method: 'get', params: { userId: selTarget.id } }).then((data: any) => {
        const d = data?.data?.data || data;
        if (d?.taskViewScope) setViewScope(d.taskViewScope);
      }).catch(() => {});
    }
  }, [selTarget]);

  const handleViewScopeChange = (val: string) => {
    setViewScope(val);
    if (selTarget?.type === 'user') {
      client.request({ url: 'sjgl02Permissions:saveSettings', method: 'post', data: { taskViewScope: val, userId: selTarget.id } }).catch(() => {});
    }
  };

  const deletePerm = (tableName: string) => setPerms(p => p.filter(x => x.tableName !== tableName || x._inherited));

  React.useEffect(() => {
    if (savingRef.current) return;
    if (!savePermsRef.current) { savePermsRef.current = true; return; }
    const nonInherited = perms.filter((p: any) => !p._inherited);
    if (nonInherited.length > 0) {
      client.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: nonInherited } }).catch(() => {});
    }
  }, [perms]);

  const savePerms = async () => {
    savingRef.current = true;
    try {
      const values = await form.validateFields();
      let updated = [...perms.filter((p: any) => !p._inherited)];
      if (modal.perm) {
        updated = updated.map(p => p.tableName === modal.perm.tableName ? { ...p, ...values } : p);
      } else {
        updated.push({ targetType: selTarget.type, targetId: selTarget.id, targetName: selTarget.nickname || selTarget.name || '', ...values });
      }
      setPerms([...updated, ...perms.filter((p: any) => p._inherited)]);
      await client.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: updated } });
      message.success('保存成功'); setModal({ open: false });
    } catch { message.error('保存失败'); }
    finally { savingRef.current = false; }
  };

  const loadAuditLogs = () => {
    setLogLoading(true);
    client.request({ url: 'sjgl02_permission_logs:list', method: 'get', params: { sort: ['-createdAt'], pageSize: 50 } })
      .then((res: any) => {
        const rows = res?.data?.data?.rows || res?.data?.data || [];
        setAuditLogs(Array.isArray(rows) ? rows : []);
      }).catch(() => setAuditLogs([]))
      .finally(() => setLogLoading(false));
  };

  React.useEffect(() => { if (subTab === 'log') loadAuditLogs(); }, [subTab]);

  const userTargets = targets.filter(t => t.type === 'user' && (!targetSearch || (t.nickname || '').toLowerCase().includes(targetSearch.toLowerCase())));
  const roleTargets = targets.filter(t => t.type === 'role' && (!targetSearch || (t.nickname || t.name || '').toLowerCase().includes(targetSearch.toLowerCase())));

  const inheritedPerms = perms.filter((p: any) => p._inherited);
  const customPerms = perms.filter((p: any) => !p._inherited);
  const isSystemManaged = selTarget?.type === 'role' && perms.length > 0 && perms.every(p => p._inherited);

  const filterFn = (p: any) => {
    if (!permSearch) return true;
    const t = tables.find((x: any) => x.name === p.tableName);
    return p.tableName.toLowerCase().includes(permSearch.toLowerCase()) || (t?.title || '').toLowerCase().includes(permSearch.toLowerCase());
  };
  const filteredInherited = inheritedPerms.filter(filterFn);
  const filteredCustom = customPerms.filter(filterFn);
  const allFiltered = [...filteredInherited, ...filteredCustom];
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / 10));
  const paged = allFiltered.slice((permPage - 1) * 10, permPage * 10);

  const renderCard = (p: any) => (
    <Card key={p.tableName + (p._inherited ? '-i' : '')} size="small" style={{ marginBottom: 8, ...(p._inherited ? { background: '#f9f9f9', opacity: 0.85 } : {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {!p._inherited && (
            <Checkbox checked={selectedRows.has(p.tableName)} onChange={e => {
              const next = new Set(selectedRows);
              e.target.checked ? next.add(p.tableName) : next.delete(p.tableName);
              setSelectedRows(next);
            }} />
          )}
          <strong>{(tables.find((t: any) => t.name === p.tableName)?.title || p.tableName) + '(' + p.tableName + ')'}</strong>
          {p._systemManaged && <Tag color="blue" style={{ fontSize: 10 }}>系统管理</Tag>}
          {p._inherited && !p._systemManaged && <Tag color="purple" style={{ fontSize: 10 }}>继承</Tag>}
        </div>
        <Space>
          {p._inherited ? (
            <Button size="small" type="link" onClick={() => setDetailModal({ open: true, perm: p })}>查看详情</Button>
          ) : (
            <>
              <Button size="small" type="link" onClick={() => {
                form.setFieldsValue(p);
                setFormCanImport(p.canImport !== false);
                setFormCanExport(p.canExport !== false);
                setFormMode(Array.isArray(p.importMode) ? p.importMode : [p.importMode || 'insert']);
                setModal({ open: true, perm: p });
                client.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: p.tableName } })
                  .then((res: any) => {
                    const fields = res?.data?.data || [];
                    setModalFields(Array.isArray(fields) ? fields.map((f: any) => ({ name: f.name, label: (f.uiSchema?.title || f.name) + '(' + f.name + ')' })) : []);
                  }).catch(() => { setModalFields([]); });
              }}>编辑</Button>
              <Button size="small" type="link" danger onClick={() => { deletePerm(p.tableName); message.success('已删除'); }}>删除</Button>
            </>
          )}
        </Space>
      </div>
      <Space wrap size={[4, 4]}>
        <Tag color={p.canImport ? 'blue' : 'default'}>导入: {p.canImport ? '是' : '否'}</Tag>
        <Tag color={p.canExport ? 'green' : 'default'}>导出: {p.canExport ? '是' : '否'}</Tag>
        {p.canImport && <>
          <Tag color="orange">模式: {(Array.isArray(p.importMode) ? p.importMode : [p.importMode || 'insert']).map((m: string) => ({ insert: '新增', update: '更新', upsert: '新增+更新' })[m] || m).join(' / ')}</Tag>
          {p.uniqueFields?.length > 0 && <Tag color="orange">唯一值: {p.uniqueFields.join(', ')}</Tag>}
          {p.requiredFields?.length > 0 && <Tag color="red">必填: {p.requiredFields.join(', ')}</Tag>}
        </>}
        {p.canImport && <Tag color="cyan">可导入: {p.importFields?.length > 0 ? p.importFields.length + '个字段' : '全部'}</Tag>}
        {p.canExport && <Tag color="purple">可导出: {p.exportFields?.length > 0 ? p.exportFields.length + '个字段' : '全部'}</Tag>}
        {p.exportFilter && Object.keys(p.exportFilter).length > 0 && <Tag color="default">📋 筛选: {JSON.stringify(p.exportFilter).substring(0, 30)}</Tag>}
      </Space>
    </Card>
  );

  const auditColumns = [
    { title: '时间', dataIndex: 'createdAt', width: 140, render: (v: any) => v ? new Date(v).toLocaleString('zh-CN') : '—' },
    { title: '操作人', dataIndex: 'operator', width: 80, render: (v: any) => v?.nickname || v?.username || '系统' },
    { title: '操作', dataIndex: 'action', width: 70, render: (v: string) => {
      const m: any = { create: <Tag color="green">创建</Tag>, update: <Tag color="orange">修改</Tag>, delete: <Tag color="red">删除</Tag>, toggle: <Tag color="blue">切换</Tag> };
      return m[v] || <Tag>{v}</Tag>;
    }},
    { title: '目标', dataIndex: 'targetName', width: 100 },
    { title: '数据表', dataIndex: 'tableName', width: 100 },
    { title: '变更概要', dataIndex: 'changes', render: (v: any) => {
      if (!v) return '—';
      if (v.after && !v.before) return '新增权限';
      if (!v.after && v.before) return '移除权限';
      return '修改权限配置';
    }},
  ];

  return (
    <div>
      <Row gutter={20}>
        <Col span={6}>
          <Card size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
            <Input.Search placeholder="搜索用户/角色..." allowClear size="small" style={{ marginBottom: 8 }}
              value={targetSearch} onChange={v => setTargetSearch(v.target.value)} />
            {[{ label: '👤 用户', items: userTargets, color: '#1677ff' }, { label: '👥 角色', items: roleTargets, color: '#52c41a' }].map(group => (
              <div key={group.label}>
                <div style={{ fontSize: 11, color: '#999', padding: '8px 8px 4px', fontWeight: 600 }}>{group.label} ({group.items.length})</div>
                {group.items.map(t => (
                  <div key={`${t.type}-${t.id}`} onClick={() => { setSelTarget(t); setPerms([]); setPermPage(1); }}
                    style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 2,
                      background: selTarget?.id === t.id && selTarget?.type === t.type ? '#e6f4ff' : undefined,
                      color: selTarget?.id === t.id && selTarget?.type === t.type ? '#1677ff' : undefined }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: group.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12 }}>
                      {t.type === 'user' ? 'U' : 'R'}
                    </div>
                    <div>
                      <div>{t.type === 'role' && t.name ? `${t.nickname || t.name}（${t.name}）` : (t.nickname || t.name)}</div>
                      {t.type === 'user' && t.roles?.length > 0 && (
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          {t.roles.map((r: any) => `${r.title || r.name}（${r.name}）`).join(' · ')}
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
          {!selTarget ? (
            <Card><Empty description="请选择左侧用户或角色" /></Card>
          ) : (
            <div>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 12,
                      background: selTarget.type === 'user' ? '#1677ff' : '#52c41a' }}>
                      {selTarget.type === 'user' ? 'U' : 'R'}
                    </div>
                    <strong>{selTarget.type === 'role' && selTarget.name ? `${selTarget.nickname || selTarget.name}（${selTarget.name}）` : (selTarget.nickname || selTarget.name)}</strong>
                    <Tag color={selTarget.type === 'user' ? 'blue' : 'green'}>{selTarget.type === 'user' ? '用户' : '角色'}</Tag>
                    {selTarget.type === 'user' && selTarget.roles?.length > 0 && (
                      <>
                        <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>角色：</span>
                        {selTarget.roles.map((r: any, i: number) => (
                          <Tag key={i} color={i === 0 ? 'green' : 'orange'} style={{ fontSize: 10 }}>{r.title || r.name}（{r.name}）</Tag>
                        ))}
                      </>
                    )}
                  </Space>
                  <Space>
                    {selTarget.type === 'user' && (<>
                      <span style={{ fontSize: 12, color: '#666' }}>任务查看范围：</span>
                      <Radio.Group value={viewScope} onChange={e => handleViewScopeChange(e.target.value)} size="small">
                        <Radio.Button value="own">仅查看自己的</Radio.Button>
                        <Radio.Button value="all">查看全部</Radio.Button>
                      </Radio.Group>
                    </>)}
                    {!isSystemManaged && <Button type="primary" size="small" onClick={() => { form.resetFields(); setModal({ open: true }); setFormCanImport(false); setFormCanExport(false); setFormMode(['insert']); }}>+ 添加权限</Button>}
                  </Space>
                </Space>
              </Card>

              <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0', marginBottom: 12 }}>
                <div onClick={() => setSubTab('perm')} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, borderBottom: subTab === 'perm' ? '2px solid #1677ff' : '2px solid transparent', color: subTab === 'perm' ? '#1677ff' : '#999', fontWeight: subTab === 'perm' ? 600 : 400, marginBottom: -2 }}>✓ 权限配置</div>
                <div onClick={() => setSubTab('log')} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, borderBottom: subTab === 'log' ? '2px solid #1677ff' : '2px solid transparent', color: subTab === 'log' ? '#1677ff' : '#999', fontWeight: subTab === 'log' ? 600 : 400, marginBottom: -2 }}>📋 操作日志</div>
              </div>

              {subTab === 'log' ? (
                <div>
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
                </div>
              ) : (
                <div>
                  {isSystemManaged && (
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
                          <Popconfirm title={`确认删除选中的 ${selectedRows.size} 条权限？`} onConfirm={() => {
                            selectedRows.forEach((name) => deletePerm(name));
                            setSelectedRows(new Set());
                            message.success('批量删除成功');
                          }} okText="确认" cancelText="取消">
                            <Button size="small" danger>批量删除 ({selectedRows.size})</Button>
                          </Popconfirm>
                        )}
                      </>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <Input.Search placeholder="搜索表名或表标识..." allowClear size="small" style={{ width: 200 }}
                        value={permSearch} onChange={v => { setPermSearch(v.target.value); setPermPage(1); }} />
                    </div>
                  </div>

                   {perms.length === 0 ? <Empty description="暂无权限配置" /> : (
                     <>
                       {(() => {
                         const visibleItems = [
                           ...(inheritedOpen ? filteredInherited : []),
                           ...(customOpen ? filteredCustom : []),
                         ];
                         const visibleTotal = visibleItems.length;
                         const safePage = Math.min(permPage, Math.max(1, Math.ceil(visibleTotal / 10)));
                         const pagedVisible = visibleItems.slice((safePage - 1) * 10, safePage * 10);
                         const pagedInh = pagedVisible.filter(p => p._inherited);
                         const pagedCus = pagedVisible.filter(p => !p._inherited);
                         return (
                           <>
                             {filteredInherited.length > 0 && (
                               <div style={{ marginBottom: 10 }}>
                                 <div onClick={() => { setInheritedOpen(!inheritedOpen); setPermPage(1); }} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#999', marginBottom: 6, userSelect: 'none' }}>
                                   <span style={{ marginRight: 4, fontSize: 11 }}>{inheritedOpen ? '▼' : '▶'}</span>
                                   📦 角色继承的权限（{filteredInherited.length}条）
                                 </div>
                                 {inheritedOpen && pagedInh.map(renderCard)}
                               </div>
                             )}
                             {filteredCustom.length > 0 && (
                               <div style={{ marginBottom: 10 }}>
                                 <div onClick={() => { setCustomOpen(!customOpen); setPermPage(1); }} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, marginBottom: 6, userSelect: 'none' }}>
                                   <span style={{ marginRight: 4, fontSize: 11 }}>{customOpen ? '▼' : '▶'}</span>
                                   ✏️ 用户自定义权限（{filteredCustom.length}条）
                                 </div>
                                 {customOpen && pagedCus.map(renderCard)}
                               </div>
                             )}
                             {visibleTotal > 10 && <div style={{ textAlign: 'center', marginTop: 8 }}>
                               <Pagination size="small" current={safePage} total={visibleTotal} pageSize={10} onChange={setPermPage} />
                             </div>}
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
      <Modal title={modal.perm ? '编辑权限' : '新增权限'} open={modal.open} onCancel={() => setModal({ open: false })} onOk={savePerms} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item label="选择数据表" name="tableName" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="选择数据表..."
              filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={tables.filter((t: any) => {
                if (modal.perm && modal.perm.tableName === t.name) return true;
                return !perms.some(p => p.tableName === t.name && !p._inherited);
              }).map((t: any) => ({ value: t.name, label: `${t.title} (${t.name})` }))}
              onChange={(val: string) => {
                if (val) {
                  client.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: val } })
                    .then((res: any) => {
                      const fields = res?.data?.data || [];
                      setModalFields(Array.isArray(fields) ? fields.map((f: any) => ({ name: f.name, label: (f.uiSchema?.title || f.name) + '(' + f.name + ')' })) : []);
                    }).catch(() => setModalFields([]));
                } else setModalFields([]);
              }} />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Form.Item label="允许导入" name="canImport" valuePropName="checked">
              <Switch onChange={v => { setFormCanImport(v); if (!v) setFormMode([]); }} /></Form.Item>
            <Form.Item label="允许导出" name="canExport" valuePropName="checked">
              <Switch onChange={v => setFormCanExport(v)} /></Form.Item>
          </Space>
          {formCanImport && (
            <>
              <Form.Item label="导入模式（可多选）" name="importMode" rules={[{ required: true, message: '请选择导入模式' }]}>
                <Select mode="multiple" onChange={v => setFormMode(v || [])} options={[
                  { value: 'insert', label: '新增 (insert)' }, { value: 'update', label: '更新 (update)' }, { value: 'upsert', label: '新增+更新 (upsert)' },
                ]} />
              </Form.Item>
              {formMode.some(m => m === 'update' || m === 'upsert') && (
                <Form.Item label="唯一值字段" name="uniqueFields" rules={[{ required: true, message: '更新/新增+更新模式必须配置唯一值字段' }]}>
                  <Select mode="multiple" showSearch placeholder="选择唯一值字段（支持搜索）"
                    filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                    options={modalFields.map(v => ({ value: v.name, label: v.label }))} />
                </Form.Item>
              )}
              <Form.Item label="必填字段" name="requiredFields">
                <Select mode="multiple" showSearch placeholder="选择必填字段（支持搜索）"
                  filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                  options={modalFields.map(v => ({ value: v.name, label: v.label }))} />
              </Form.Item>
              <Form.Item label="可导入字段（空=全部允许）" name="importFields">
                <Select mode="multiple" showSearch placeholder="空=全部允许"
                  filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                  options={modalFields.map(v => ({ value: v.name, label: v.label }))} />
              </Form.Item>
            </>
          )}
          {formCanExport && (
            <>
              <Form.Item label="可导出字段（空=全部允许）" name="exportFields">
                <Select mode="multiple" showSearch placeholder="空=全部允许"
                  filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                  options={modalFields.map(v => ({ value: v.name, label: v.label }))} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 查看详情弹窗（只读） */}
      <Modal title="📋 查看权限详情" open={detailModal.open} onCancel={() => setDetailModal({ open: false })} footer={<Button onClick={() => setDetailModal({ open: false })}>关闭</Button>} width={680}>
        {detailModal.perm && (
          <div>
            <Alert type="info" showIcon message={`此权限为继承权限，不可在此编辑。来源：${selTarget?.type === 'user' ? '用户所属角色' : '系统管理角色'}`} style={{ marginBottom: 12 }} />
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
