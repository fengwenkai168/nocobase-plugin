// @ts-nocheck
import React from 'react';
import { Card, Tabs, Button, Space, Select, Table, Tag, Statistic, Row, Col, Input, InputNumber, message, Checkbox, Switch, Steps, Progress, Empty, Descriptions, Drawer, Modal, Form, Radio, Upload, Pagination, Alert } from 'antd';
import { InboxOutlined, TableOutlined } from '@ant-design/icons';
import { VERSION, apiRequest } from './shared';
import { useAPI } from '../../client-v2/utils/api';

const { Dragger } = Upload;

export default function ExportPanel() {
  const client = useAPI();
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
      setIsAdminOrRoot(roles.includes('admin') || roles.includes('root'));
    }).catch(() => {});
  }, []);

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
            if (roles.includes('admin') || roles.includes('root')) { setFields(allFields); setSelFields(allFields.map((f: any) => f.name)); return; }
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
      client.request({ url: 'sjgl02Export:previewCount', method: 'post', data: { tableName: selTable } })
        .then((res: any) => { const c = res?.data?.data?.estimatedRows; if (typeof c === 'number') setEstimatedRows(c); })
        .catch(() => {});
    } else if (selTable === '__all__') {
      client.request({ url: 'sjgl02Export:previewCount', method: 'post', data: { tableName: '__all__' } })
        .then((res: any) => { const c = res?.data?.data?.estimatedRows; if (typeof c === 'number') setEstimatedRows(c); })
        .catch(() => {});
    }
  }, [selTable]);

  const toggleField = (name: string) => setSelFields(p => p.includes(name) ? p.filter(f => f !== name) : [...p, name]);
  const regular = fields.filter(f => !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type) && !f.isForeignKey);
  const assoc = fields.filter(f => ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type));
  const fkFields = fields.filter(f => f.isForeignKey);

  const handleExport = () => {
    Modal.confirm({
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
          <Card title="⚙️ 高级选项" size="small">
            <Space style={{ marginBottom: 12 }}>
              <span style={{ color: '#999' }}>文件命名规则：</span>
              <Input style={{ width: 280 }} value={fileName} onChange={e => setFileName(e.target.value)} />
            </Space>
            <div style={{ fontSize: 11, color: '#999' }}>支持 {`{表名}`} {`{日期}`} 占位符</div>
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
