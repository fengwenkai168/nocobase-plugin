import React from 'react';
import { Card, Button, Space, Select, Tag, Statistic, Row, Col, Input, Checkbox, Switch, Steps, Alert, App, Radio } from 'antd';
import { VERSION, apiRequest } from './shared';
import { useAPI } from '../utils/api';
import { useApp, CollectionFilterPanel } from '@nocobase/client-v2';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';

export default function ExportPanel() {
  const client = useAPI();
  const app = useApp<any>();
  const { message, modal } = App.useApp();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [step, setStep] = React.useState(0);
  const [tables, setTables] = React.useState<any[]>([]);
  const [selTable, setSelTable] = React.useState('');
  const [isAllTables, setIsAllTables] = React.useState(false);
  const [isAdminOrRoot, setIsAdminOrRoot] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [fields, setFields] = React.useState<any[]>([]);
  const [selFields, setSelFields] = React.useState<string[]>([]);
  const [fileName, setFileName] = React.useState('{表名}_{日期}.xlsx');
  const [exporting, setExporting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [taskId, setTaskId] = React.useState<number | null>(null);
  const [includeAssocSheet, setIncludeAssocSheet] = React.useState(false);
  const [selectedAssocTables, setSelectedAssocTables] = React.useState<string[]>([]);
  const [includeAttachments, setIncludeAttachments] = React.useState(false);
  const [estimatedRows, setEstimatedRows] = React.useState<number | null>(null);
  const [headerStyle, setHeaderStyle] = React.useState<string>('title_id');
  const [permSource, setPermSource] = React.useState<{ type: string; id?: string; label?: string } | null>(null);
  const [permSourceOptions, setPermSourceOptions] = React.useState<any[]>([]);
  const [permExportFields, setPermExportFields] = React.useState<string[]>([]);
  const [exportScopes, setExportScopes] = React.useState<any[]>([]);
  const [currentUserFilter, setCurrentUserFilter] = React.useState<Record<string, any> | null>(null);
  const [loadingScopes, setLoadingScopes] = React.useState(false);
  const [scopeSourceLabel, setScopeSourceLabel] = React.useState<string>('');

  React.useEffect(() => {
    apiRequest(client, 'sjgl02Permissions:tables').then((data) => {
      if (!Array.isArray(data)) return;
      const allTables = data.map((t: any) => ({ name: t.name, title: t.title || t.name }));
      apiRequest(client, 'auth:check').then((userData: any) => {
        const uid = userData?.data?.id || userData?.id;
        const roles = (userData?.roles || userData?.data?.roles || []).map((r: any) => r.name || '');
        if (roles.includes('admin') || roles.includes('root')) { setTables(allTables); return; }
        if (!uid) { setTables(allTables); return; }
        apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: 'user', targetId: String(uid) } }).then((permData: any) => {
          const allowedNames = new Set([...(permData?.custom || []), ...(permData?.inherited || [])].filter((p: any) => p.canExport).map((p: any) => p.tableName));
          setTables(allTables.filter(t => allowedNames.has(t.name)));
        }).catch(() => setTables(allTables));
      }).catch(() => setTables(allTables));
    }).catch(() => {}).finally(() => setLoading(false));
    apiRequest(client, 'auth:check').then((userData: any) => {
      const roles = (userData?.data?.roles || userData?.roles || []).map((r: any) => r.name || '');
      const isAdmin = roles.includes('admin') || roles.includes('root');
      const uid = userData?.data?.id || userData?.id;
      setIsAdminOrRoot(isAdmin);
      apiRequest(client, 'sjgl02Permissions:userRoleList').then((list: any) => {
        const opts: any[] = [];
        if (isAdmin) {
          opts.push({ value: 'admin', label: '管理员完整权限', type: 'admin' });
        }
        if (!isAdmin && uid) {
          opts.push({ value: `user:${uid}`, label: '👤 当前用户 — 用户方案', type: 'user', id: String(uid) });
        }
        (list?.users || []).forEach((u: any) => {
          if (isAdmin || String(u.id) === String(uid)) {
            opts.push({ value: `user:${u.id}`, label: `👤 ${u.nickname || u.username || u.id} — 用户方案`, type: 'user', id: String(u.id) });
          }
        });
        (list?.roles || []).forEach((r: any) => {
          if (isAdmin || roles.includes(r.name)) {
            opts.push({ value: `role:${r.name}`, label: `👥 ${r.title || r.name} — 角色方案`, type: 'role', id: r.name });
          }
        });
        setPermSourceOptions(opts);
        if (isAdmin) {
          setPermSource({ type: 'admin', label: '管理员完整权限' });
        } else if (opts.length > 0) {
          const first = opts[0];
          setPermSource({ type: first.type, id: first.id, label: first.label });
        }
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!selTable || selTable === '__all__') return;
    setLoadingScopes(true);
    const params: any = { tableName: selTable };
    if (permSource && permSource.type !== 'admin' && permSource.id) {
      params.permSourceType = permSource.type;
      params.permSourceId = permSource.id;
    }
    apiRequest(client, 'sjgl02Permissions:scopes', { data: params }).then((res: any) => {
      const scopes = res?.options || [];
      setExportScopes(scopes);
      const withFilter = scopes.find((s: any) => s.exportFilter && Object.keys(s.exportFilter).length > 0);
      if (withFilter) {
        setPermSource({ type: withFilter.type, id: withFilter.id, label: withFilter.label });
        setScopeSourceLabel(withFilter.label);
        setCurrentUserFilter(withFilter.exportFilter);
      } else if (scopes.length > 0) {
        const first = scopes[0];
        setPermSource({ type: first.type, id: first.id, label: first.label });
        setScopeSourceLabel(first.label);
        setCurrentUserFilter(null);
      } else {
        setScopeSourceLabel(permSource?.label || '');
        setCurrentUserFilter(null);
      }
    }).catch(() => {
      setExportScopes([]);
      setCurrentUserFilter(null);
    }).finally(() => setLoadingScopes(false));
  }, [selTable, permSource?.type, permSource?.id]);

  React.useEffect(() => {
    if (!selTable || selTable === '__all__' || !isAdminOrRoot) return;
    const allOpts = permSourceOptions.length > 0 ? permSourceOptions : [];
    if (allOpts.length === 0) return;
    const filtered: any[] = [{ value: 'admin', label: '管理员完整权限', type: 'admin' }];
    const promises = allOpts.filter(o => o.type !== 'admin').map(async (o) => {
      try {
        const res = await apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: o.type, targetId: o.id } });
        const perms = (res?.custom || []).concat(res?.inherited || []);
        if (perms.some((p: any) => p.tableName === selTable && p.canExport)) filtered.push(o);
      } catch {}
    });
    Promise.all(promises).then(() => setPermSourceOptions(filtered));
  }, [selTable, isAdminOrRoot]);

  const handlePermSourceChange = (val: string) => {
    if (val === 'admin') { setPermSource({ type: 'admin', label: '管理员完整权限' }); setPermExportFields([]); setCurrentUserFilter(null); setScopeSourceLabel('管理员完整权限'); return; }
    const [type, id] = val.split(':');
    const option = permSourceOptions.find(o => o.value === val);
    setPermSource({ type, id, label: option?.label });
    setScopeSourceLabel(option?.label || '');
    apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: type, targetId: id } }).then((permData: any) => {
      const perm = (permData?.custom || []).concat(permData?.inherited || []).find((p: any) => p.tableName === selTable);
      if (perm?.canExport && perm?.exportFields?.length > 0) {
        setPermExportFields(perm.exportFields);
      } else {
        setPermExportFields([]);
      }
      setCurrentUserFilter(perm?.exportFilter || null);
    }).catch(() => { setPermExportFields([]); setCurrentUserFilter(null); });
  };

  // 权限方案切换时重载字段
  React.useEffect(() => {
    if (!selTable || selTable === '__all__') return;
    client.request({ url: 'sjgl02Export:tableFields', method: 'get', params: { tableName: selTable } })
      .then((res: any) => {
        const fArr = res?.data?.data || [];
        if (!Array.isArray(fArr)) return;
        const allFields = fArr.map((f: any) => ({ ...f, displayName: f.name }));
        if (!permSource || permSource.type === 'admin') {
          setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); return;
        }
        apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: permSource.type, targetId: permSource.id } }).then((permData: any) => {
          const perm = (permData?.custom || []).concat(permData?.inherited || []).find((p: any) => p.tableName === selTable);
          if (perm?.canExport && perm?.exportFields?.length > 0) {
            const filtered = allFields.filter((f: any) => perm.exportFields.includes(f.name));
            setFields(filtered); setSelFields(filtered.map((f: any) => f.name));
          } else { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); }
        }).catch(() => { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); });
      }).catch(() => {});
  }, [permSource?.type, permSource?.id]);

  // 当 selTable 变化时加载字段
  React.useEffect(() => {
    if (selTable && selTable !== '__all__') {
      client.request({ url: 'sjgl02Export:tableFields', method: 'get', params: { tableName: selTable } })
        .then((res: any) => {
          const fArr = res?.data?.data || [];
          if (!Array.isArray(fArr)) return;
          const allFields = fArr.map((f: any) => ({ ...f, displayName: f.name }));
          apiRequest(client, 'auth:check').then((userData: any) => {
            const uid = userData?.data?.id || userData?.id;
            const roles = (userData?.roles || userData?.data?.roles || []).map((r: any) => r.name || '');
            if (roles.includes('admin') || roles.includes('root')) {
              if (!permSource || permSource.type === 'admin') { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); return; }
              apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: permSource.type, targetId: permSource.id } }).then((permData: any) => {
                const perm = (permData?.custom || []).concat(permData?.inherited || []).find((p: any) => p.tableName === selTable);
                if (perm?.canExport && perm?.exportFields?.length > 0) {
                  const filtered = allFields.filter((f: any) => perm.exportFields.includes(f.name));
                  setFields(filtered); setSelFields(filtered.map((f: any) => f.name));
                } else { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); }
              }).catch(() => { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); });
              return;
            }
            if (!uid) { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); return; }
            apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: 'user', targetId: String(uid) } }).then((permData: any) => {
              const perms = [...(permData?.custom || []), ...(permData?.inherited || [])];
              const perm = perms.find((p: any) => p.tableName === selTable && p.canExport);
              if (perm?.exportFields?.length > 0) {
                const filtered = allFields.filter((f: any) => perm.exportFields.includes(f.name));
                setFields(filtered);
                setSelFields(filtered.map((f: any) => f.name));
              } else {
                setFields(allFields);
                setSelFields(allFields.map((f: any) => f.name));
              }
            }).catch(() => { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); });
          }).catch(() => { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); });
        }).catch(() => {});
      client.request({ url: 'sjgl02Export:previewCount', method: 'post', data: { tableName: selTable, permSource: permSource || null } })
        .then((res: any) => { const c = res?.data?.data?.estimatedRows; if (typeof c === 'number') setEstimatedRows(c); })
        .catch(() => {});
    } else if (selTable === '__all__') {
      client.request({ url: 'sjgl02Export:previewCount', method: 'post', data: { tableName: '__all__' } })
        .then((res: any) => { const c = res?.data?.data?.estimatedRows; if (typeof c === 'number') setEstimatedRows(c); })
        .catch(() => {});
    }
  }, [selTable]);

  const selTableCollection = React.useMemo(() => {
    if (!selTable || selTable === '__all__') return undefined;
    const ds = app?.dataSourceManager?.getDataSource?.('main');
    return ds?.getCollection?.(selTable);
  }, [app, selTable]);

  const toggleField = (name: string) => setSelFields(p => p.includes(name) ? p.filter(f => f !== name) : [...p, name]);
  const regular = fields.filter(f => !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type) && !f.isForeignKey);
  const assoc = fields.filter(f => ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type));
  const fkFields = fields.filter(f => f.isForeignKey);

  const handleExport = () => {
    modal.confirm({
      title: '确认导出',
      content: isAllTables ? '将导出全部数据表，任务在后台异步执行' : includeAttachments ? '将生成 .zip 压缩包（含附件文件），任务在后台异步执行' : '将生成 .xlsx 文件，任务在后台异步执行',
      onOk: async () => {
        try {
          await client.request({
            url: 'sjgl02Export:execute',
            method: 'post',
            data: {
              tableName: selTable,
              selectedFields: isAllTables ? [] : selFields,
              fileNameTemplate: fileName,
              includeAssociationSheet: includeAssocSheet,
              associationSheetTables: selectedAssocTables,
              includeAttachments,
              headerStyle,
              filter: currentUserFilter,
              permSource: permSource || null,
            },
          });
          message.success('导出任务已提交，请在任务管理中查看进度和下载');
          setStep(0);
        } catch { message.error('提交失败'); }
      },
    });
  };

  return (
    <div>
      <Steps current={step} items={[{ title: '选择数据表' }, { title: '选择字段 & 配置' }, { title: '执行导出' }]} style={{ marginBottom: 24 }} />
      {step === 0 && (
        <div>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="📋 选择数据表" size="small">
                <Select style={{ width: '100%' }} placeholder="— 请选择数据表 —" loading={loading} showSearch value={selTable || undefined}
                  onChange={(val: string) => { setSelTable(val); setIsAllTables(val === '__all__'); }}
                  filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
                  options={[
                    ...(isAdminOrRoot ? [{ value: '__all__', label: '📦 全部数据表（含系统表）' }] : []),
                    ...tables.map(t => ({ value: t.name, label: `📁 ${t.title} (${t.name})` })),
                  ]} />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{isAdminOrRoot ? `共 ${tables.length + 1} 个选项` : `共 ${tables.length} 个选项`}</div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="⚙️ 简要配置" size="small">
                <ul style={{ color: '#666', paddingLeft: 16, fontSize: 13, lineHeight: 1.9 }}>
                  <li>支持全字段选择和自定义筛选</li>
                  <li>关联字段可选「显示值」或「仅ID」</li>
                  <li>自定义文件名模板</li>
                </ul>
              </Card>
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button type="primary" disabled={!selTable} onClick={() => setStep(1)}>下一步 →</Button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          {isAdminOrRoot && !isAllTables && (
            <Card size="small" style={{ marginBottom: 12, backgroundColor: '#f0f7ff', border: '1px solid #bae0ff' }}>
              <Space>
                <span style={{ color: '#666', fontSize: 13 }}>切换已配置的方案：</span>
                <Select value={permSource?.type === 'admin' ? 'admin' : (permSource ? `${permSource.type}:${permSource.id}` : 'admin')}
                  onChange={handlePermSourceChange} style={{ minWidth: 220 }} size="small"
                  options={permSourceOptions} />
              </Space>
            </Card>
          )}
          {isAllTables ? (
            <Card title="📦 全部数据表导出" size="small" style={{ marginBottom: 12 }}>
              <p>✅ 将导出系统中所有数据表，最终打包为 <strong>ZIP 压缩包</strong></p>
              <p style={{ marginTop: 8 }}>📋 包含以下 {tables.length} 张表：</p>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <Space wrap>{tables.map((t: any) => <Tag key={t.name} color="blue">{t.title}({t.name})</Tag>)}</Space>
              </div>
            </Card>
          ) : (
            <>
              <Card title="☑️ 字段选择" size="small" style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <Checkbox indeterminate={selFields.length > 0 && selFields.length < fields.length}
                    checked={selFields.length === fields.length && fields.length > 0}
                    onChange={() => selFields.length === fields.length ? setSelFields([]) : setSelFields(fields.map(f => f.name))}>
                    全选 <span style={{ color: '#999', fontSize: 12 }}>已选: {selFields.length}/{fields.length}</span>
                  </Checkbox>
                </div>
                {regular.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>📄 常规字段 ({regular.length})</div>
                    <Space wrap style={{ marginBottom: 12 }}>
                      {regular.map(f => <Checkbox key={f.name} checked={selFields.includes(f.name)} onChange={() => toggleField(f.name)}>{(f.uiSchema?.title || f.name) + '(' + f.name + ')'}</Checkbox>)}
                    </Space>
                  </>
                )}
                {assoc.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#7c3aed', marginBottom: 6 }}>🔗 关联字段 ({assoc.length})</div>
                    <Space wrap>
                      {assoc.map(f => <Checkbox key={f.name} checked={selFields.includes(f.name)} onChange={() => toggleField(f.name)}>{(f.uiSchema?.title || f.name) + '(' + f.name + ')'}</Checkbox>)}
                    </Space>
                  </>
                )}
                {fkFields.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#d97706', marginBottom: 6 }}>🔑 关联主键 ({fkFields.length})</div>
                    <Space wrap>
                      {fkFields.map(f => <Checkbox key={f.name} checked={selFields.includes(f.name)} onChange={() => toggleField(f.name)}>{(f.uiSchema?.title || f.name) + '(' + f.name + ')'}</Checkbox>)}
                    </Space>
                  </>
                )}
              </Card>
              {assoc.length > 0 && (
                <Card title="📑 关联数据 Sheet" size="small" style={{ marginBottom: 12 }}>
                  <Space>
                    <Switch checked={includeAssocSheet} onChange={setIncludeAssocSheet} />
                    <span>包含关联数据 Sheet</span>
                  </Space>
                  {includeAssocSheet && (
                    <div style={{ marginTop: 8 }}>
                      <Select mode="multiple" style={{ width: '100%' }} placeholder="选择要包含的关联表"
                        value={selectedAssocTables} onChange={setSelectedAssocTables}
                        options={assoc.filter(f => selFields.includes(f.name)).map((f: any) => ({ value: f.name, label: (f.uiSchema?.title || f.name) + '(' + f.name + ')' }))} />
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
          {!isAllTables && (
            <Card title="📊 数据范围" size="small" style={{ marginBottom: 12 }} loading={loadingScopes}>
              <div style={{ marginBottom: 10 }}>
                <Alert type="info" showIcon message={`⚙️ 当前权限方案：${scopeSourceLabel || '默认'}`} />
              </div>
              {currentUserFilter && Object.keys(currentUserFilter).length > 0 ? (
                <>
                  <Alert type="warning" showIcon message="当前方案已限定导出范围，不可修改" style={{ marginBottom: 10 }} />
                  {selTableCollection ? (
                    <CollectionFilterPanel
                      collection={selTableCollection}
                      initialValue={currentUserFilter}
                      onChange={() => {}}
                      t={t as any}
                    />
                  ) : (
                    <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 4 }}>{JSON.stringify(currentUserFilter, null, 2)}</pre>
                  )}
                </>
              ) : (
                <>
                  <Alert type="info" showIcon message="当前方案未配置固定范围，可自定义筛选条件" style={{ marginBottom: 10 }} />
                  {selTableCollection ? (
                    <CollectionFilterPanel
                      collection={selTableCollection}
                      initialValue={currentUserFilter || undefined}
                      onChange={(filter) => setCurrentUserFilter(filter || null)}
                      t={t as any}
                    />
                  ) : (
                    <Alert type="warning" message="无法加载数据表集合，暂不支持自定义筛选" />
                  )}
                </>
              )}
            </Card>
          )}
          <Card title="⚙️ 高级选项" size="small">
            <Space style={{ marginBottom: 12 }}>
              <span style={{ color: '#999' }}>文件命名规则：</span>
              <Input style={{ width: 280 }} value={fileName} onChange={e => setFileName(e.target.value)} />
            </Space>
            <div style={{ fontSize: 11, color: '#999' }}>支持 {`{表名}`} {`{日期}`} 占位符</div>
            <Space style={{ marginTop: 8 }}>
              <span style={{ color: '#999' }}>表头格式：</span>
              <Radio.Group value={headerStyle} onChange={e => setHeaderStyle(e.target.value)} size="small">
                <Radio.Button value="title_id">字段名(字段标识)</Radio.Button>
                <Radio.Button value="title">字段名</Radio.Button>
                <Radio.Button value="id">字段标识</Radio.Button>
              </Radio.Group>
            </Space>
            <Space style={{ marginTop: 8 }}>
              <Switch checked={includeAttachments} onChange={setIncludeAttachments} />
              <span>包含附件文件</span>
            </Space>
          </Card>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={() => setStep(0)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={() => setStep(2)} disabled={!selTable || (!isAllTables && selFields.length === 0)}>下一步 →</Button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="选择字段" value={isAllTables ? '全部' : selFields.length} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="预计行数" value={estimatedRows ?? '...'} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="文件命名" value={fileName} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="格式" value={isAllTables ? '.zip' : (includeAttachments ? '.zip' : '.xlsx')} /></Card></Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setStep(1)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={handleExport}>▶ 执行导出</Button>
          </div>
        </div>
      )}
    </div>
  );
}
