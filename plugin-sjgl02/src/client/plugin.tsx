import { Plugin, useAPIClient } from '@nocobase/client';
import React from 'react';
import { Card, Tabs, Button, Space, Select, Table, Tag, Statistic, Row, Col, Input, InputNumber, message, Checkbox, Switch, Steps, Progress, Empty, Descriptions, Drawer, Modal, Form, Radio, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

const VERSION = 'v1.0.24';

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
          }).catch(() => { setExcelHeaders([]); setAvailSheets(['Sheet1']); });
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
    }).catch(() => message.error('预览失败'));
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
      content: '导入在事务中执行，任一行失败则整批回滚。',
      onOk: () => {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(fieldMapping)) {
          if (v === '__custom__') { mapped[k] = customValues[k] ?? ''; }
          else { mapped[k] = v; }
        }
        client.request({
          url: 'sjgl02Import:execute',
          method: 'post',
          data: {
            tableName: selectedTable?.name,
            fileId: uploadedFileId,
            sheetName,
            headerRow,
            fieldMapping: mapped,
            importMode,
            uniqueFields,
          },
        }).then(() => {
          message.success('导入任务已提交');
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
                    options={tableFields.map((f: any) => ({ value: f.name, label: f.name }))} />
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
                          </span>
                        ),
                      },
                    ] as any}
                    pagination={false} size="small" />
                </Card>
              )}
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={() => setStep(0)} style={{ marginRi