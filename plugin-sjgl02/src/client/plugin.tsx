import { Plugin, useAPIClient } from '@nocobase/client';
import React from 'react';
import { Card, Tabs, Button, Space, Select, Table, Tag, Statistic, Row, Col, Input, InputNumber, message, Checkbox, Switch, Steps, Progress, Empty, Descriptions, Drawer, Modal, Form, Radio, Upload } from 'antd';
import { InboxOutlined, TableOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

const VERSION = 'v1.0.27';

// ====== API 工具 ======
function apiRequest(client: any, url: string, opts: any = {}) {
  if (!client || !client.request) {
    console.warn('[sjgl02] apiRequest: client not ready for', url);
    return Promise.reject(new Error('Client not ready'));
  }
  const method = (opts.method || 'get').toLowerCase();
  return client.request({ url, method, data: opts.data, params: opts.params })
    .then((res: any) => res?.data?.data ?? res?.data ?? null)
    .catch((err: any) => {
      console.error('[sjgl02] API error:', url, err?.response?.status);
      return Promise.reject(err);
    });
}

// ====== 主页面 ======
function Sjgl02SettingsPageV1() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#1677ff,#0958d9)', borderRadius: 12, padding: '14px 24px', color: '#fff', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>📊 数据管理</div>
          <div style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>导入导出 · 任务管理 · 表级权限控制</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 11 }}>
          @my-project/plugin-sjgl02 {VERSION}
        </div>
      </div>
      <Card style={{ borderRadius: 10, minHeight: 500 }}>
        <Tabs defaultActiveKey="import" destroyInactiveTabPane items={[
          { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
          { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
          { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
          { key: 'permissions', label: '✓ 权限管理', children: <PermissionPanel /> },
        ]} />
      </Card>
    </div>
  );
}

// ====== 导入面板 ======
function ImportPanel() {
  const client = useAPIClient();
  const [step, setStep] = React.useState(0);
  const [selectedTable, setSelectedTable] = React.useState<any>(null);
  const [importMode, setImportMode] = React.useState('insert');
  const [uploadedFileId, setUploadedFileId] = React.useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = React.useState('');
  const [tableFields, setTableFields] = React.useState<any[]>([]);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [uniqueFields, setUniqueFields] = React.useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = React.useState<Record<string, string>>({});
  const [customValues, setCustomValues] = React.useState<Record<string, string>>({});
  const [excelHeaders, setExcelHeaders] = React.useState<string[]>([]);
  const [sheetName, setSheetName] = React.useState('Sheet1');
  const [headerRow, setHeaderRow] = React.useState(1);
  const [availSheets, setAvailSheets] = React.useState<string[]>(['Sheet1']);
  const [previewModal, setPreviewModal] = React.useState(false);
  const [previewMeta, setPreviewMeta] = React.useState<any>(null);

  const doParse = () => {
    if (!uploadedFileId) return;
    client.request({ url: 'sjgl02Import:uploadParse', method: 'post', data: { fileId: uploadedFileId, sheetName, headerRow } })
      .then((pr: any) => {
        const pd = pr?.data?.data;
        if (pd?.headerColumns) setExcelHeaders(pd.headerColumns);
        if (pd?.sheets) { setAvailSheets(pd.sheets); }
        setPreviewMeta(pd);
      }).catch(() => { setExcelHeaders([]); setAvailSheets([]); setPreviewMeta(null); });
  };

  React.useEffect(() => { doParse(); }, [sheetName, headerRow]);

  const [tables, setTables] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiRequest(client, 'sjgl02Permissions:tables').then((data) => {
      if (Array.isArray(data)) {
        setTables(data.map((t: any) => ({ name: t.name, title: t.title || t.name })));
      }
    }).catch(() => message.error('加载表列表失败')).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (selectedTable?.name) {
      client.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: selectedTable.name } })
        .then((res: any) => {
          const fields = res?.data?.data || [];
          setTableFields(Array.isArray(fields) ? fields : []);
        })
        .catch(() => {});
    }
  }, [selectedTable?.name]);

  const handleFileSelect = (info: any) => {
    if (info.file.status === 'done') {
      const resp = info.file.response;
      const fileId = resp?.id;
      if (fileId) {
        setUploadedFileId(fileId);
        setUploadedFileName(info.file.name);
        message.success(`${info.file.name} 上传成功`);
          client.request({ url: 'sjgl02Import:uploadParse', method: 'post', data: { fileId } })
            .then((pr: any) => {
              const pd = pr?.data?.data;
              if (pd?.headerColumns) setExcelHeaders(pd.headerColumns);
              if (pd?.sheets) { setAvailSheets(pd.sheets); if (pd.sheets[0]) setSheetName(pd.sheets[0]); }
              setPreviewMeta(pd);
            }).catch(() => { setExcelHeaders([]); setAvailSheets(['Sheet1']); setPreviewMeta(null); });
      } else {
        message.error('上传响应中未找到文件ID');
      }
    } else if (info.file.status === 'error') {
      message.error('上传失败，请重试');
    }
  };

  const handlePreview = () => {
    if (!uploadedFileId) return;
    client.request({
      url: 'sjgl02Import:preview',
      method: 'get',
      params: { fileId: uploadedFileId, sheetName, headerRow },
    }).then((res: any) => {
      setPreviewData(res?.data?.data || null);
    }).catch((err: any) => {
      const msg = err?.response?.data?.errors?.[0]?.message || err?.message || '预览失败';
      message.error(msg);
    });
  };

  const handleAutoMatch = () => {
    const mapping: Record<string, string> = {};
    tableFields.forEach((f) => {
      const match = excelHeaders.find((h: string) =>
        h === f.name || h.toLowerCase() === f.name.toLowerCase()
      );
      if (match) mapping[f.name] = match;
    });
    setFieldMapping(mapping);
    message.success('自动匹配完成');
  };

  const handleExecute = () => {
    Modal.confirm({
      title: '确认导入',
      content: '导入在事务中执行，任一行失败则整批回滚。关联字段通过主键ID匹配，匹配失败则整批回滚。',
      onOk: () => {
        client.request({
          url: 'sjgl02Import:execute',
          method: 'post',
          data: {
            tableName: selectedTable?.name,
            fileId: uploadedFileId,
            sheetName,
            headerRow,
            fieldMapping,
            customValues,
            importMode,
            uniqueFields,
          },
        }).then(() => {
          message.success('导入任务已提交，可在任务管理中查看进度');
          setStep(0); setSelectedTable(null); setUploadedFileId(null);
          setUploadedFileName(''); setFieldMapping({}); setPreviewData(null);
          setCustomValues({}); setExcelHeaders([]); setAvailSheets(['Sheet1']);
        }).catch(() => message.error('提交失败'));
      },
    });
  };

  return (
    <div>
      <Steps current={step} items={[{ title: '选择数据表' }, { title: '上传文件 & 字段映射' }, { title: '预览 & 执行' }]} style={{ marginBottom: 24 }} />
      {step === 0 && (
        <div>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="📋 选择目标数据表" size="small">
                <Select style={{ width: '100%' }} placeholder="— 请选择数据表 —" loading={loading} showSearch
                  value={selectedTable?.name || undefined}
                  onChange={(val) => setSelectedTable(tables.find(t => t.name === val) || null)}
                  filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
                  options={tables.map((t) => ({ value: t.name, label: `📁 ${t.title} (${t.name})` }))} />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>共 {tables.length} 张表</div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="ℹ️ 导入说明" size="small">
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
                  <p>• 支持 <strong>.xlsx</strong> / <strong>.xls</strong> / <strong>.csv</strong></p>
                  <p>• 文件最大 <strong>50 MB</strong></p>
                  <p>• 三种模式：<Tag color="blue">新增</Tag> <Tag color="green">更新</Tag> <Tag color="orange">新增+更新</Tag></p>
                </div>
              </Card>
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button type="primary" disabled={!selectedTable} onClick={() => setStep(1)}>下一步 →</Button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          {!uploadedFileId ? (
            <Dragger name="file" multiple={false} accept=".xlsx,.xls,.csv"
              customRequest={({ file, onSuccess, onError }: any) => {
                const fd = new FormData();
                fd.append('file', file);
                client.request({ url: 'attachments:create', method: 'post', data: fd })
                  .then((r: any) => {
                    const d = r?.data?.data ?? r?.data;
                    onSuccess({ id: d?.id, ...d }, file);
                  })
                  .catch(onError);
              }}
              onChange={handleFileSelect}
              beforeUpload={(file) => {
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (!['xlsx', 'xls', 'csv'].includes(ext || '')) { message.error('不支持的文件格式'); return Upload.LIST_IGNORE; }
                if (file.size > 50 * 1024 * 1024) { message.error('文件超过 50MB 限制'); return Upload.LIST_IGNORE; }
                return true;
              }}
              style={{ marginBottom: 20 }}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽上传文件</p>
              <p className="ant-upload-hint">支持 .xlsx / .xls / .csv，最大 50MB</p>
            </Dragger>
          ) : (
            <div>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Tag color="blue">{uploadedFileName}</Tag>
                <Button size="small" style={{ marginLeft: 8 }}
                  onClick={() => { setUploadedFileId(null); setUploadedFileName(''); setExcelHeaders([]); setFieldMapping({}); }}>
                  重新上传
                </Button>
                <Space style={{ marginLeft: 16 }}>
                  <span style={{ color: '#999' }}>Sheet：</span>
                  <Select value={sheetName} onChange={setSheetName} style={{ width: 120 }}
                    options={availSheets.map(s => ({ value: s, label: s }))} />
                   <span style={{ color: '#999' }}>表头行：</span>
                   <InputNumber min={1} max={100} value={headerRow} onChange={v => setHeaderRow(v || 1)} style={{ width: 70 }} />
                   <Button size="small" icon={<TableOutlined />}
                     disabled={!previewMeta?.previewRows?.length}
                     onClick={() => setPreviewModal(true)}>预览表头</Button>
                 </Space>
              </Card>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space>
                  <span style={{ color: '#999' }}>导入模式：</span>
                  <Select value={importMode} onChange={setImportMode} style={{ width: 220 }}
                    options={[
                      { value: 'insert', label: '新增 (insert)' },
                      { value: 'update', label: '更新 (update)' },
                      { value: 'upsert', label: '新增+更新 (upsert)' },
                    ]} />
                </Space>
              </Card>
              {(importMode === 'update' || importMode === 'upsert') && (
                <Card size="small" style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>🔑 唯一值字段</div>
                  <Select mode="multiple" value={uniqueFields} onChange={setUniqueFields}
                    style={{ width: '100%' }} placeholder="选择唯一值字段"
                    options={tableFields.map((f: any) => ({ value: f.name, label: (f.uiSchema?.title || f.name) + '(' + f.name + ')' }))} />
                </Card>
              )}
              {excelHeaders.length > 0 && (
                <Card size="small" title={<span>📊 字段映射（{tableFields.length}字段/已映射{Object.values(fieldMapping).filter(v=>v&&v!=='__ignore__').length}）<Button size="small" style={{ marginLeft: 12 }} onClick={handleAutoMatch}>⚡ 自动匹配</Button></span>} style={{ marginBottom: 12 }}>
                  <Table
                    dataSource={tableFields.map((f: any, i: number) => ({ field: f, key: i }))}
                    columns={[
                      {
                        title: 'Excel列 / 自定义值',
                        width: 220,
                        render: (record: any) => {
                          const val = fieldMapping[record.field.name];
                          const isCustom = val === '__custom__';
                          const used = Object.values(fieldMapping).filter(v => v && v !== '__ignore__' && v !== '__custom__');
                          return (
                            <div>
                              <Select style={{ width: '100%' }} placeholder="忽略" value={val || undefined}
                                onChange={v => setFieldMapping(prev => ({ ...prev, [record.field.name]: v }))} allowClear>
                                <Select.Option value="__ignore__">🚫 忽略</Select.Option>
                                <Select.Option value="__custom__">✏️ 自定义固定值</Select.Option>
                                {excelHeaders.map((h: string) => (
                                  <Select.Option key={h} value={h} disabled={used.includes(h) && val !== h}>
                                    {h}{used.includes(h) && val !== h ? ' (已用)' : ''}
                                  </Select.Option>
                                ))}
                              </Select>
                              {isCustom && (
                                <Input size="small" style={{ marginTop: 4 }} placeholder="输入固定值"
                                  value={customValues[record.field.name] || ''}
                                  onChange={e => setCustomValues(prev => ({ ...prev, [record.field.name]: e.target.value }))} />
                              )}
                            </div>
                          );
                    },
                      },
                    { title: '→', width: 30, render: () => <span style={{ color: '#999' }}>→</span> },
                      {
                        title: '映射方式',
                        width: 80,
                        render: (record: any) => {
                          const val = fieldMapping[record.field.name];
                          if (!val || val === '__ignore__') return <Tag>忽略</Tag>;
                          if (val === '__custom__') return <Tag color="green">固定值</Tag>;
                          return <Tag color="blue">Excel列</Tag>;
                        },
                      },
                      { title: '→', width: 30, render: () => <span style={{ color: '#999' }}>→</span> },
                      {
                        title: '工作表字段',
                        width: 150,
                        render: (record: any) => (
                          <span>
                            {record.field.isRequired && <span style={{ color: '#ff4d4f' }}>* </span>}
                            {record.field.uiSchema?.title || record.field.name}({record.field.name})
                            {uniqueFields.includes(record.field.name) && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>🔑 唯一值</Tag>}
                          </span>
                        ),
                      },
                    ] as any}
                    pagination={false} size="small" />
                </Card>
      )}
      <Modal title="📋 表头及预览数据" open={previewModal} onCancel={() => setPreviewModal(false)}
        footer={<Button onClick={() => setPreviewModal(false)}>关闭</Button>}
        width={800}>
        {previewMeta && (
          <div>
            <Descriptions size="small" column={3} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Sheet">{sheetName}</Descriptions.Item>
              <Descriptions.Item label="表头行">{headerRow}</Descriptions.Item>
              <Descriptions.Item label="数据行数">{previewMeta.totalRows || 0}</Descriptions.Item>
            </Descriptions>
            <Table dataSource={previewMeta.previewRows?.map((row: any, idx: number) => ({ ...row, __rowKey: idx })) || []}
              rowKey="__rowKey"
              columns={previewMeta.headerColumns?.map((h: string) => ({ title: h, dataIndex: h, ellipsis: true })) || []}
              pagination={false} size="small" scroll={{ x: 'max-content' }} />
          </div>
        )}
        {!previewMeta && <Empty description="请先上传并解析文件" />}
      </Modal>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={() => setStep(0)} style={{ marginRight: 8 }}>← 上一步</Button>
              <Button type="primary" disabled={(() => {
                if (!uploadedFileId) return true;
                if (importMode === 'insert') return false;
                if (uniqueFields.length === 0) return true;
                if (uniqueFields.some(uf => !fieldMapping[uf] || fieldMapping[uf] === '__ignore__' || fieldMapping[uf] === '__custom__')) return true;
                return false;
              })()}
                onClick={async () => { await handlePreview(); setStep(2); }}>下一步 →</Button>
          </div>
            </div>
          )}
        </div>
      )}
      {step === 2 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>预览确认 — {selectedTable?.title || selectedTable?.name}</div>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="预计导入行数" value={previewData?.totalRows || 0} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="错误行数" value={0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="导入模式" value={importMode === 'insert' ? '新增' : importMode === 'update' ? '更新' : importMode === 'upsert' ? '新增+更新' : importMode} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="Sheet名称" value={sheetName} /></Card></Col>
          </Row>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col span={12}><span style={{ color: '#666' }}>📄 上传文件：</span><Tag color="blue">{uploadedFileName}</Tag></Col>
              <Col span={12}><span style={{ color: '#666' }}>📋 表头行：</span><span>{headerRow}</span></Col>
            </Row>
            <div style={{ marginTop: 8 }}>
              <span style={{ color: '#666' }}>📊 目标工作表：</span>
              <Tag color="blue">{selectedTable?.title || selectedTable?.name} ({selectedTable?.name})</Tag>
            </div>
            {uniqueFields.length > 0 && (
              <div style={{ marginTop: 8 }}><span style={{ color: '#666' }}>🔑 唯一值字段：</span><Space wrap>{uniqueFields.map(f => <Tag key={f} color="orange">{f}</Tag>)}</Space></div>
            )}
            {Object.values(customValues).some(v => v) && (
              <div style={{ marginTop: 8 }}><span style={{ color: '#666' }}>✏️ 自定义固定值：</span><Space wrap>{Object.entries(customValues).filter(([, v]) => v).map(([k, v]) => (<Tag key={k} color="green">{k}: {v}</Tag>))}</Space></div>
            )}
          </Card>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>👁️ 预览数据（前10行）</div>
          {previewData?.preview ? (
            <Table
              dataSource={previewData.preview.map((r: any, i: number) => {
                const row: any = { key: i };
                Object.entries(fieldMapping).forEach(([fieldName, excelCol]) => {
                  if (excelCol === '__custom__') {
                    row[fieldName] = customValues[fieldName] || '';
                  } else if (excelCol && excelCol !== '__ignore__') {
                    row[excelCol] = r[excelCol] !== undefined ? r[excelCol] : '';
                  }
                });
                return row;
              })}
              columns={(() => {
                const cols: any[] = [];
                const seen = new Set<string>();
                const titles: Record<string, string> = {};
                tableFields.forEach((f: any) => { titles[f.name] = f.uiSchema?.title || f.name; });
                Object.entries(fieldMapping).forEach(([fieldName, excelCol]) => {
                  const disp = titles[fieldName] || fieldName;
                  if (excelCol === '__custom__') {
                    cols.push({ title: '自定义-' + disp + '(' + fieldName + ')', dataIndex: fieldName });
                  } else if (excelCol && excelCol !== '__ignore__' && !seen.has(excelCol)) {
                    seen.add(excelCol);
                    cols.push({ title: excelCol + '-' + disp + '(' + fieldName + ')', dataIndex: excelCol });
                  }
                });
                return cols;
              })()}
              pagination={false} size="small" />
          ) : (
            <Empty description="暂无预览数据，请返回上一步上传文件" />
          )}
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button onClick={() => setStep(1)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={handleExecute} disabled={!previewData}>▶ 执行导入</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== 导出面板 ======
function ExportPanel() {
  const client = useAPIClient();
  const [step, setStep] = React.useState(0);
  const [tables, setTables] = React.useState<any[]>([]);
  const [selTable, setSelTable] = React.useState('');
  const [isAllTables, setIsAllTables] = React.useState(false);
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
      if (Array.isArray(data)) {
        setTables(data.map((t: any) => ({ name: t.name, title: t.title || t.name })));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (selTable && selTable !== '__all__') {
      client.request({ url: 'sjgl02Export:tableFields', method: 'get', params: { tableName: selTable } })
        .then((res: any) => {
          const fArr = res?.data?.data || [];
          if (Array.isArray(fArr)) {
            setFields(fArr.map((f: any) => ({ ...f, displayName: f.name })));
            setSelFields(fArr.map((f: any) => f.name));
          }
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
                    { value: '__all__', label: '📦 全部数据表（含系统表）' },
                    ...tables.map(t => ({ value: t.name, label: `📁 ${t.title} (${t.name})` })),
                  ]} />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>共 {tables.length + 1} 个选项</div>
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
                <Space wrap>{tables.map((t: any) => <Tag key={t.name} color="blue">{t.title}</Tag>)}</Space>
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
                        options={assoc.filter(f => selFields.includes(f.name)).map((f: any) => ({ value: f.name, label: f.name }))} />
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

// ====== 任务管理面板 ======
function TaskPanel() {
  const client = useAPIClient();
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [taskType, setTaskType] = React.useState('all');
  const [status, setStatus] = React.useState('all');
  const [drawer, setDrawer] = React.useState<any>(null);
  const [tableTitles, setTableTitles] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    apiRequest(client, 'sjgl02Permissions:tables').then((data) => {
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        data.forEach((t: any) => { map[t.name] = t.title || t.name; });
        setTableTitles(map);
      }
    }).catch(() => {});
  }, []);

  const loadTasks = () => {
    setLoading(true);
    apiRequest(client, 'sjgl02Tasks:list', { params: { taskType, status } }).then((data) => {
      if (data && Array.isArray(data.items)) {
        setTasks(data.items);
      } else {
        setTasks([]);
      }
    }).catch(() => setTasks([])).finally(() => setLoading(false));
  };

  React.useEffect(() => { loadTasks(); }, [taskType, status]);
  React.useEffect(() => { const t = setInterval(loadTasks, 10000); return () => clearInterval(t); }, [taskType, status]);

  const handleView = async (task: any) => {
    try {
      const res = await client.request({ url: 'sjgl02Tasks:detail', method: 'get', params: { taskId: task.id } });
      const t = res?.data?.data || task;
      const fileId = t.exportFileId || t.importFileId;
      if (fileId) {
        try {
          const att = await client.request({ url: 'attachments:get', method: 'get', params: { filterByTk: fileId } });
          t._fileName = att?.data?.data?.filename || att?.data?.data?.title || '';
        } catch { t._fileName = ''; }
      }
      if (t.tableName) {
        try {
          const fd = await client.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: t.tableName } });
          const fields = fd?.data?.data || [];
          const map: Record<string, string> = {};
          (Array.isArray(fields) ? fields : []).forEach((f: any) => { map[f.name] = f.uiSchema?.title || f.name; });
          t._fieldTitles = map;
        } catch { t._fieldTitles = {}; }
      }
      setDrawer(t);
    } catch { setDrawer(task); }
  };
  const handleCancel = (task: any) => {
    Modal.confirm({ title: '确认取消', content: '确定要取消此任务吗？', onOk: async () => {
      await client.request({ url: 'sjgl02Tasks:cancel', method: 'post', data: { taskId: task.id } });
      message.success('已取消'); loadTasks();
    }});
  };

  const statusColors: any = { pending: 'orange', processing: 'blue', completed: 'green', failed: 'red', cancelled: 'default' };
  const statusLabels: any = { pending: '排队中', processing: '进行中', completed: '已完成', failed: '失败', cancelled: '已取消' };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <span style={{ color: '#666' }}>类型：</span>
          <Select value={taskType} onChange={setTaskType} style={{ width: 100 }}
            options={[{ value: 'all', label: '全部' }, { value: 'import', label: '导入' }, { value: 'export', label: '导出' }]} />
          <span style={{ color: '#666' }}>状态：</span>
          <Select value={status} onChange={setStatus} style={{ width: 100 }}
            options={[{ value: 'all', label: '全部' }, { value: 'pending', label: '排队中' }, { value: 'processing', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'failed', label: '失败' }, { value: 'cancelled', label: '已取消' }]} />
          <Button onClick={loadTasks}>🔄 刷新</Button>
        </Space>
      </Card>
      <Table loading={loading} dataSource={tasks.map((t: any) => ({ ...t, key: t.id }))} size="small" pagination={{ pageSize: 20 }}
        columns={[
          { title: '任务ID', dataIndex: 'id', render: (v: any) => `#${v}` },
          { title: '类型', dataIndex: 'taskType', render: (v: any) => <Tag color={v === 'import' ? 'blue' : 'green'}>{v === 'import' ? '导入' : '导出'}</Tag> },
          { title: '目标表', dataIndex: 'tableName', render: (v: any) => (tableTitles[v] || v) + '(' + v + ')' },
          { title: '状态', dataIndex: 'status', render: (v: any) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag> },
          { title: '进度', dataIndex: 'progress', render: (v: any) => <Progress percent={v || 0} size="small" style={{ minWidth: 80 }} /> },
          { title: '数据量', render: (_: any, r: any) => `${r.processedRows || 0}/${r.totalRows || 0}` },
          { title: '创建人', dataIndex: ['createdBy', 'nickname'], render: (v: any) => v || '—' },
          { title: '创建时间', dataIndex: 'createdAt', render: (v: any) => v ? new Date(v).toLocaleString() : '—' },
          { title: '操作', render: (_: any, r: any) => (
            <Space>
              <Button type="link" size="small" onClick={() => handleView(r)}>👁 查看</Button>
              {['pending', 'processing'].includes(r.status) && <Button type="link" size="small" danger onClick={() => handleCancel(r)}>⏹ 取消</Button>}
            </Space>
          )},
        ]} />
      <Drawer title="任务日志" open={!!drawer} onClose={() => setDrawer(null)} width={680}>
        {drawer && (() => {
          const modeLabel = drawer.importMode === 'insert' ? '新增' : drawer.importMode === 'update' ? '更新' : drawer.importMode === 'upsert' ? '新增+更新' : drawer.importMode;
          const fieldTitles = drawer._fieldTitles || {};
          return (<div>
            <Descriptions title="任务摘要" column={2} size="small" bordered>
              <Descriptions.Item label="任务ID">#{drawer.id}</Descriptions.Item>
              <Descriptions.Item label="类型"><Tag color={drawer.taskType === 'import' ? 'blue' : 'green'}>{drawer.taskType === 'import' ? '导入' : '导出'}</Tag></Descriptions.Item>
              <Descriptions.Item label="目标表">{(tableTitles[drawer.tableName] || drawer.tableName) + '(' + drawer.tableName + ')'}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusColors[drawer.status]}>{statusLabels[drawer.status]}</Tag></Descriptions.Item>
              <Descriptions.Item label="创建人">{drawer.createdBy?.nickname || '—'}</Descriptions.Item>
              <Descriptions.Item label="数据量">{drawer.processedRows || 0}/{drawer.totalRows || 0}</Descriptions.Item>
              {drawer.taskType === 'import' && <Descriptions.Item label="Sheet名称">{drawer.sheetName || '—'}</Descriptions.Item>}
              {drawer.taskType === 'import' && <Descriptions.Item label="导入模式">{modeLabel}</Descriptions.Item>}
              {drawer.taskType === 'import' && <Descriptions.Item label="唯一值字段">{drawer.uniqueFields?.length > 0 ? drawer.uniqueFields.join(', ') : '—'}</Descriptions.Item>}
              <Descriptions.Item label="创建时间">{drawer.createdAt ? new Date(drawer.createdAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{drawer.completedAt ? new Date(drawer.completedAt).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="文件名">
                {drawer._fileName ? (
                  <Space size={4}>
                    <span>{drawer._fileName}</span>
                    {drawer.importFileId && <Button type="link" size="small" onClick={() => window.open('/api/attachments:download/' + drawer.importFileId)}>⬇ 下载导入源文件</Button>}
                    {drawer.exportFileId && <Button type="link" size="small" onClick={() => {
                      client.request({ url: 'sjgl02Export:download', method: 'get', params: { taskId: drawer.id }, responseType: 'blob' })
                        .then((res: any) => {
                          const disp = res.headers?.['content-disposition'] || '';
                          const m = disp.match(/filename\*=UTF-8''(.+)|filename="?([^";]+)/);
                          const name = m ? decodeURIComponent(m[1] || m[2] || 'export.xlsx') : 'export.xlsx';
                          const url = URL.createObjectURL(res.data);
                          const a = document.createElement('a'); a.href = url; a.download = name; a.click();
                          URL.revokeObjectURL(url);
                        }).catch(() => message.error('下载失败'));
                    }}>⬇ 下载导出文件</Button>}
                  </Space>
                ) : '—'}
              </Descriptions.Item>
            </Descriptions>
            {drawer.errorMessage && (
              <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', padding: '12px 16px', borderRadius: 6, margin: '16px 0' }}>
                ❌ 错误信息：{drawer.errorMessage}
              </div>
            )}
            {drawer.status === 'completed' && drawer.taskType === 'import' && (
              <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: '12px 16px', borderRadius: 6, margin: '16px 0' }}>
                ✅ 导入成功：共 {drawer.totalRows} 行，成功导入 {drawer.processedRows} 行
              </div>
            )}
            {drawer.fieldMapping && Object.keys(drawer.fieldMapping).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📊 字段映射</div>
                <Table dataSource={Object.entries(drawer.fieldMapping).filter(([, v]: any) => v && v !== '__ignore__').map(([k, v]: any, i: number) => ({
                  key: i,
                  field: (fieldTitles[k] || k) + '(' + k + ')',
                  type: v === '__custom__' ? '固定值写入' : 'Excel列',
                  value: v === '__custom__' ? '（未存储）' : v,
                }))}
                  columns={[
                    { title: '工作表字段', dataIndex: 'field' },
                    { title: '映射方式', width: 90, render: (_:any, r:any) => r.type === '固定值写入' ? <Tag color="green">固定值写入</Tag> : <Tag color="blue">Excel列</Tag> },
                    { title: '→', width: 30 },
                    { title: 'Excel列/固定值', dataIndex: 'value' },
                  ]} pagination={false} size="small" />
              </div>
            )}
            {drawer.taskType === 'export' && drawer.tableName === '__all__' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📦 全部数据表导出</div>
                <div style={{ color: '#666', fontSize: 13 }}>共 {drawer.totalRows || 0} 张表，导出 {drawer.processedRows || 0} 行数据</div>
              </div>
            )}
            {drawer.taskType === 'export' && drawer.tableName !== '__all__' && drawer.selectedFields && drawer.selectedFields.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 导出字段选择</div>
                <Space wrap>{(drawer.selectedFields as string[]).map((f: string) => <Tag key={f} color="blue">{(fieldTitles[f] || f) + '(' + f + ')'}</Tag>)}</Space>
              </div>
            )}
            {drawer.taskType === 'export' && drawer.includeAssociationSheet && drawer.associationSheetTables && (drawer.associationSheetTables as any[]).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📑 关联数据 Sheet（{(drawer.associationSheetTables as any[]).length}个）</div>
                <Space wrap>{(drawer.associationSheetTables as string[]).map((f: string) => <Tag key={f} color="purple">{(fieldTitles[f] || f) + '(' + f + ')'}</Tag>)}</Space>
              </div>
            )}
            {(drawer.errorLogs?.length > 0) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>❌ 错误日志 ({drawer.errorLogs.length}条)</div>
                <Table dataSource={drawer.errorLogs.map((l: any, i: number) => ({ ...l, key: i }))}
                  columns={[{ title: '行号', dataIndex: 'row', width: 60 }, { title: 'Excel行', dataIndex: 'excelRow', width: 60 }, { title: '原因', dataIndex: 'reason' }, { title: '快照', dataIndex: 'snapshot', render: (v: any) => v ? String(v).substring(0, 200) : '—' }]} pagination={false} size="small" />
              </div>
            )}
            {!drawer.errorMessage && (!drawer.fieldMapping || Object.keys(drawer.fieldMapping).length === 0) && (!drawer.selectedFields || drawer.selectedFields.length === 0) && (!drawer.errorLogs || drawer.errorLogs.length === 0) && (
              <Empty description="暂无详细日志" style={{ marginTop: 16 }} />
            )}
          </div>);
        })()}
      </Drawer>
    </div>
  );
}

// ====== 权限管理面板 ======
function PermissionPanel() {
  const client = useAPIClient();
  const [targets, setTargets] = React.useState<any[]>([]);
  const [selTarget, setSelTarget] = React.useState<any>(null);
  const [perms, setPerms] = React.useState<any[]>([]);
  const [viewScope, setViewScope] = React.useState('own');
  const [modal, setModal] = React.useState<any>({ open: false });
  const [form] = Form.useForm();
  const [tables, setTables] = React.useState<any[]>([]);
  const [modalFields, setModalFields] = React.useState<string[]>([]);

  React.useEffect(() => {
    apiRequest(client, 'sjgl02Permissions:userRoleList').then((data) => {
      if (data) {
        const users = (data.users || []).map((u: any) => ({ ...u, type: 'user' }));
        const roles = (data.roles || []).map((r: any) => ({ id: r.id, nickname: r.title || r.name, name: r.name, type: 'role' }));
        setTargets([...users, ...roles]);
      }
    }).catch(() => {});
    apiRequest(client, 'sjgl02Permissions:tables').then((data) => {
      if (Array.isArray(data)) {
        setTables(data.map((t: any) => ({ name: t.name, title: t.title || t.name })));
      }
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (selTarget) {
      client.request({ url: 'sjgl02Permissions:get', method: 'get', params: { targetType: selTarget.type, targetId: selTarget.id } })
        .then((res: any) => {
          const p = res?.data?.data;
          setPerms(Array.isArray(p) ? p : []);
        }).catch(() => setPerms([]));
    }
  }, [selTarget]);

  const togglePerm = (tableName: string, field: string) => {
    setPerms(p => p.map(x => x.tableName === tableName ? { ...x, [field]: !x[field] } : x));
  };
  const deletePerm = (tableName: string) => setPerms(p => p.filter(x => x.tableName !== tableName));
  const savePermsRef = React.useRef(false);
  React.useEffect(() => {
    if (!savePermsRef.current) { savePermsRef.current = true; return; }
    client.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: perms } }).catch(() => {});
  }, [perms]);
  const savePerms = async () => {
    try {
      await client.request({ url: 'sjgl02Permissions:save', method: 'post', data: { permissions: perms } });
      message.success('保存成功'); setModal({ open: false });
    } catch { message.error('保存失败'); }
  };

  const userTargets = targets.filter(t => t.type === 'user');
  const roleTargets = targets.filter(t => t.type === 'role');

  return (
    <Row gutter={20}>
      <Col span={6}>
        <Card size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
          {[{ label: '👤 用户', items: userTargets, color: '#1677ff' }, { label: '👥 角色', items: roleTargets, color: '#52c41a' }].map(group => (
            <div key={group.label}>
              <div style={{ fontSize: 11, color: '#999', padding: '8px 8px 4px', fontWeight: 600 }}>{group.label} ({group.items.length})</div>
              {group.items.map(t => (
                <div key={`${t.type}-${t.id}`} onClick={() => { setSelTarget(t); setPerms([]); }}
                  style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 2,
                    background: selTarget?.id === t.id && selTarget?.type === t.type ? '#e6f4ff' : undefined,
                    color: selTarget?.id === t.id && selTarget?.type === t.type ? '#1677ff' : undefined }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: group.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12 }}>
                    {t.type === 'user' ? 'U' : 'R'}
                  </div>
                  <span>{t.nickname || t.name}</span>
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
                  <strong>{selTarget.nickname || selTarget.name}</strong>
                  <Tag color={selTarget.type === 'user' ? 'blue' : 'green'}>{selTarget.type === 'user' ? '用户' : '角色'}</Tag>
                </Space>
                <Space>
                  <span style={{ fontSize: 12, color: '#666' }}>任务查看范围：</span>
                  <Radio.Group value={viewScope} onChange={e => setViewScope(e.target.value)} size="small">
                    <Radio.Button value="own">仅查看自己的</Radio.Button>
                    <Radio.Button value="all">查看全部</Radio.Button>
                  </Radio.Group>
                  <Button type="primary" size="small" onClick={() => { form.resetFields(); setModal({ open: true }); }}>+ 添加权限</Button>
                </Space>
              </Space>
            </Card>
            {perms.length === 0 ? <Empty description="暂无权限配置" /> : perms.map(p => (
              <Card key={p.tableName} size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Space>
                    <strong>{p.tableName}</strong>
                    <Switch checkedChildren="导入" unCheckedChildren="导入" checked={p.canImport} onChange={() => togglePerm(p.tableName, 'canImport')} />
                    <Switch checkedChildren="导出" unCheckedChildren="导出" checked={p.canExport} onChange={() => togglePerm(p.tableName, 'canExport')} />
                  </Space>
                  <Space>
                    <Button size="small" onClick={() => {
                      form.setFieldsValue(p);
                      setModal({ open: true, perm: p });
                      client.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: p.tableName } })
                        .then((res: any) => {
                          const fields = res?.data?.data || [];
                          setModalFields(Array.isArray(fields) ? fields.map((f: any) => f.name) : []);
          }).catch(() => { setModalFields([]); });
                    }}>编辑</Button>
                    <Button size="small" danger onClick={() => deletePerm(p.tableName)}>删除</Button>
                  </Space>
                </div>
                <Space wrap>
                  <Tag color={p.canImport ? 'blue' : 'default'}>导入: {p.canImport ? '是' : '否'}</Tag>
                  <Tag color={p.canExport ? 'green' : 'default'}>导出: {p.canExport ? '是' : '否'}</Tag>
                  <Tag color="orange">模式: {p.importMode || 'insert'}</Tag>
                  {p.uniqueFields?.length > 0 && <Tag color="orange">唯一值: {p.uniqueFields.join(',')}</Tag>}
                  {p.requiredFields?.length > 0 && <Tag color="red">必填: {p.requiredFields.join(',')}</Tag>}
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Col>
      <Modal title={modal.perm ? '编辑权限' : '添加权限'} open={modal.open} onCancel={() => setModal({ open: false })} onOk={savePerms} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item label="选择数据表" name="tableName" rules={[{ required: true }]}>
            <Select showSearch options={tables.map((t: any) => ({ value: t.name, label: `${t.title} (${t.name})` }))}
              onChange={(val: string) => {
                if (val) {
                  client.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: val } })
                    .then((res: any) => {
                      const fields = res?.data?.data || [];
                      setModalFields(Array.isArray(fields) ? fields.map((f: any) => f.name) : []);
                    }).catch(() => setModalFields([]));
                } else setModalFields([]);
              }} />
          </Form.Item>
          <Space style={{ marginBottom: 12 }}>
            <Form.Item label="允许导入" name="canImport" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item label="允许导出" name="canExport" valuePropName="checked"><Switch /></Form.Item>
          </Space>
          <Form.Item label="导入模式" name="importMode">
            <Select options={[{ value: 'insert', label: '新增 (insert)' }, { value: 'update', label: '更新 (update)' }, { value: 'upsert', label: '新增+更新 (upsert)' }]} />
          </Form.Item>
          <Form.Item label="唯一值字段" name="uniqueFields">
            <Select mode="multiple" placeholder="选择唯一值字段" options={modalFields.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="必填字段" name="requiredFields">
            <Select mode="multiple" placeholder="选择必填字段" options={modalFields.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="可导入字段" name="importFields">
            <Select mode="multiple" placeholder="空=全部允许" options={modalFields.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item label="可导出字段" name="exportFields">
            <Select mode="multiple" placeholder="空=全部允许" options={modalFields.map(v => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}

// ====== 区块组件 ======
function Sjgl02Block() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: 'linear-gradient(135deg,#1677ff,#0958d9)', borderRadius: 10, padding: '10px 20px', color: '#fff', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>📊 数据管理</div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>@my-project/plugin-sjgl02 {VERSION}</div>
      </div>
      <Tabs destroyInactiveTabPane items={[
        { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
        { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
        { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
      ]} />
    </div>
  );
}

export class PluginSjgl02Client extends Plugin {
  async load() {
    this.pluginSettingsManager.add('sjgl02', {
      title: '数据管理',
      icon: 'DatabaseOutlined',
      Component: Sjgl02SettingsPageV1,
    });

    this.app.addComponents({ SjglBlock: Sjgl02Block });
    this.app.schemaInitializerManager.addItem('page:addBlock', 'sjgl02.block', { title: '数据管理', Component: 'SjglBlock' });
    this.app.schemaInitializerManager.addItem('popup:common:addBlock', 'sjgl02.block', { title: '数据管理', Component: 'SjglBlock' });
  }
}
