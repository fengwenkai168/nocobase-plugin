// @ts-nocheck
import React from 'react';
import { Card, Tabs, Button, Space, Select, Table, Tag, Statistic, Row, Col, Input, InputNumber, message, Checkbox, Switch, Steps, Progress, Empty, Descriptions, Drawer, Modal, Form, Radio, Upload, Pagination, Alert } from 'antd';
import { InboxOutlined, TableOutlined } from '@ant-design/icons';
import { VERSION, apiRequest } from './shared';
import { useAPI } from '../../client-v2/utils/api';

const { Dragger } = Upload;

export default function ImportPanel() {
  const client = useAPI();
  const [step, setStep] = React.useState(0);
  const [selectedTable, setSelectedTable] = React.useState<any>(null);
  const [importMode, setImportMode] = React.useState('insert');
  const [allowedModes, setAllowedModes] = React.useState<string[]>(['insert', 'update', 'upsert']);
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
    setFieldMapping({});
    setCustomValues({});
    setUniqueFields(permUniqueFields.length > 0 ? permUniqueFields : uniqueFields);
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
      if (!Array.isArray(data)) return;
      const allTables = data.map((t: any) => ({ name: t.name, title: t.title || t.name }));
      apiRequest(client, 'auth:check').then((userData: any) => {
        const uid = userData?.data?.id || userData?.id;
        if (!uid) { setTables(allTables); return; }
        apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: 'user', targetId: String(uid) } }).then((permData: any) => {
          const allowedNames = new Set([...(permData?.custom || []), ...(permData?.inherited || [])].filter((p: any) => p.canImport).map((p: any) => p.tableName));
          setTables(allTables.filter(t => allowedNames.has(t.name)));
        }).catch(() => setTables(allTables));
      }).catch(() => setTables(allTables));
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

  const [permUniqueFields, setPermUniqueFields] = React.useState<string[]>([]);
  const [permRequiredFields, setPermRequiredFields] = React.useState<string[]>([]);
  const [permImportFields, setPermImportFields] = React.useState<string[]>([]);
  const [autoMatchFlag, setAutoMatchFlag] = React.useState(false);
  const [matchInfo, setMatchInfo] = React.useState('');

  React.useEffect(() => {
    if (selectedTable?.name) {
      apiRequest(client, 'auth:check').then((userData: any) => {
        const currentUserId = userData?.data?.id || userData?.id;
        const roles = (userData?.roles || userData?.data?.roles || []).map((r: any) => r.name || '');
        if (roles.includes('admin') || roles.includes('root')) {
          setAllowedModes(['insert', 'update', 'upsert']);
          setImportMode('upsert');
          setPermUniqueFields([]); setPermRequiredFields([]); setPermImportFields([]);
          return;
        }
        if (!currentUserId) { setAllowedModes(['insert', 'update', 'upsert']); return; }
        apiRequest(client, 'sjgl02Permissions:get', { params: { targetType: 'user', targetId: String(currentUserId) } }).then((permData: any) => {
          const userPerm = (permData?.custom || []).find((p: any) => p.tableName === selectedTable.name);
          const rolePerm = (permData?.inherited || []).find((p: any) => p.tableName === selectedTable.name && p.canImport);
          const effectivePerm = userPerm || rolePerm;
          if (userPerm) {
            if (userPerm.canImport && userPerm.importMode) {
              setAllowedModes(Array.isArray(userPerm.importMode) ? userPerm.importMode : [userPerm.importMode]);
            } else {
              setAllowedModes([]);
            }
          } else if (rolePerm) {
            const modes = rolePerm.importMode;
            setAllowedModes(Array.isArray(modes) && modes.length > 0 ? modes : ['insert', 'update', 'upsert']);
          } else {
            setAllowedModes(['insert', 'update', 'upsert']);
          }
          const modes = userPerm?.importMode || rolePerm?.importMode || ['insert', 'update', 'upsert'];
          const modeList = Array.isArray(modes) ? modes : [modes];
          const pickMode = (list: string[]) => {
            if (list.includes('upsert')) return 'upsert';
            if (list.includes('update')) return 'update';
            if (list.includes('insert')) return 'insert';
            return 'insert';
          };
          setImportMode(pickMode(modeList));
          if (effectivePerm) {
            setPermUniqueFields(effectivePerm.uniqueFields || []);
            setPermRequiredFields(effectivePerm.requiredFields || []);
            setPermImportFields(effectivePerm.importFields || []);
            if (effectivePerm.uniqueFields?.length > 0) setUniqueFields(effectivePerm.uniqueFields);
          } else {
            setPermUniqueFields([]); setPermRequiredFields([]); setPermImportFields([]);
          }
        }).catch(() => { setAllowedModes(['insert', 'update', 'upsert']); setPermUniqueFields([]); setPermRequiredFields([]); setPermImportFields([]); });
      }).catch(() => setAllowedModes(['insert', 'update', 'upsert']));
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
              if (pd?.headerColumns) { setExcelHeaders(pd.headerColumns); setAutoMatchFlag(true); }
              if (pd?.sheets) { setAvailSheets(pd.sheets); if (pd.sheets[0]) setSheetName(pd.sheets[0]); }
              setPreviewMeta(pd);
              if (permUniqueFields.length > 0) setUniqueFields(permUniqueFields);
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
    const allowedSet = permImportFields.length > 0 ? new Set(permImportFields) : null;
    let matched = 0, unmatched = 0;
    tableFields.forEach((f) => {
      if (allowedSet && !allowedSet.has(f.name)) return;
      const title = f.uiSchema?.title || '';
      const displayLabel = title || f.name;
      const match = excelHeaders.find((h: string) =>
        h === f.name || h.toLowerCase() === f.name.toLowerCase() ||
        (title && (h === title || h.toLowerCase() === title.toLowerCase())) ||
        (() => { const m = h.match(/\(([^)]+)\)$/); return m && (m[1] === f.name || m[1].toLowerCase() === f.name.toLowerCase()); })() ||
        h.includes(f.name) ||
        (title && h.includes(title))
      );
      if (match) {
        mapping[f.name] = match;
        matched++;
      } else if (permRequiredFields.includes(f.name) || permUniqueFields.includes(f.name)) {
        mapping[f.name] = '__custom__';
        unmatched++;
      } else {
        unmatched++;
      }
    });
    permUniqueFields.forEach((uf) => {
      if (!mapping[uf]) mapping[uf] = '__custom__';
    });
    setFieldMapping(mapping);
    setMatchInfo(`${matched}成功/${unmatched}未匹配`);
  };

  const handleClearMapping = () => {
    setFieldMapping({});
    setCustomValues({});
    message.success('已清空字段映射');
  };

  React.useEffect(() => {
    if (autoMatchFlag && excelHeaders.length > 0 && tableFields.length > 0) {
      handleAutoMatch();
      setAutoMatchFlag(false);
    }
  }, [excelHeaders, tableFields, autoMatchFlag]);

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
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#999' }}>📋 导入到的数据表：</span>
                    <Tag color="blue">{(selectedTable?.title || selectedTable?.name)}({selectedTable?.name})</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>上传的文件：</span>
                    <Tag color="blue">{uploadedFileName}</Tag>
                    <Button size="small" style={{ marginLeft: 4 }}
                      onClick={() => { setUploadedFileId(null); setUploadedFileName(''); setExcelHeaders([]); setFieldMapping({}); if (permUniqueFields.length === 0) setUniqueFields([]); }}>
                      重新上传
                    </Button>
                    {previewMeta && (
                      <span style={{ color: '#999', fontSize: 12, marginLeft: 4 }}>
                        共 {previewMeta.headerColumns?.length || 0} 列 / {previewMeta.totalRows || 0} 行数据
                      </span>
                    )}
                    <span style={{ color: '#bbb', fontSize: 12, marginLeft: 4 }}>|</span>
                    <span style={{ color: '#999', fontSize: 12 }}>Sheet：</span>
                    <Select value={sheetName} onChange={setSheetName} style={{ minWidth: 120 }} size="small"
                      options={availSheets.map(s => ({ value: s, label: s }))} />
                    <span style={{ color: '#999', fontSize: 12 }}>表头行：</span>
                    <InputNumber min={1} max={100} value={headerRow} onChange={v => setHeaderRow(v || 1)} style={{ width: 70 }} size="small" />
                    <Button size="small" icon={<TableOutlined />}
                      disabled={!previewMeta?.previewRows?.length}
                      onClick={() => setPreviewModal(true)}>预览表头</Button>
                  </div>
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 4 }}>
                    <Space>
                      <span style={{ color: '#999', fontSize: 12 }}>导入模式：</span>
                      {allowedModes.length === 1 ? (
                        <Tag color="orange">{allowedModes[0] === 'insert' ? '新增' : allowedModes[0] === 'update' ? '更新' : '新增+更新'}</Tag>
                      ) : allowedModes.length > 1 ? (
                        <Select value={importMode} onChange={setImportMode} style={{ width: 220 }} size="small"
                          options={[
                            { value: 'insert', label: '新增 (insert)' },
                            { value: 'update', label: '更新 (update)' },
                            { value: 'upsert', label: '新增+更新 (upsert)' },
                          ].filter(o => allowedModes.includes(o.value))} />
                      ) : (
                        <Tag color="red">无权限</Tag>
                      )}
                    </Space>
                  </div>
               </Card>
              {(importMode === 'update' || importMode === 'upsert') && (
                <Card size="small" style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>🔑 唯一值字段</div>
                  {permUniqueFields.length > 0 ? (
                    <div>
                      <Space wrap>{permUniqueFields.map(f => <Tag key={f} color="orange">{(tableFields.find((tf: any) => tf.name === f)?.uiSchema?.title || f) + '(' + f + ')'}</Tag>)}</Space>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>⚠️ 唯一值字段由管理员配置，不可修改</div>
                    </div>
                  ) : (
                    <Select mode="multiple" value={uniqueFields} onChange={setUniqueFields}
                      style={{ width: '100%' }} placeholder="选择唯一值字段"
                      options={tableFields.map((f: any) => ({ value: f.name, label: (f.uiSchema?.title || f.name) + '(' + f.name + ')' }))} />
                  )}
                </Card>
              )}
              {excelHeaders.length > 0 && (
                <Card size="small" title={<span>📊 字段映射 · {matchInfo && <Tag color={matchInfo.includes('0未匹配') ? 'green' : 'orange'} style={{ fontSize: 11 }}>⚡{matchInfo}</Tag>}<Button size="small" style={{ marginLeft: 12 }} onClick={handleAutoMatch}>⚡ 自动匹配</Button><Button size="small" style={{ marginLeft: 6 }} onClick={handleClearMapping}>🗑 清空</Button></span>} style={{ marginBottom: 12 }}>
                  {permRequiredFields.length > 0 && (
                    <Alert type="warning" showIcon style={{ marginBottom: 8, fontSize: 12 }}
                      message={<span>必填字段：<Space wrap>{permRequiredFields.map(f => {
                        const mapped = fieldMapping[f];
                        const ok = mapped && mapped !== '__ignore__';
                        const label = (tableFields.find((tf: any) => tf.name === f)?.uiSchema?.title || f) + '(' + f + ')';
                        return <Tag key={f} color={ok ? 'green' : 'red'}>{label}{ok ? ' ✓已映射' : ' ✗未映射'}</Tag>;
                      })}</Space></span>} />
                  )}
                  {permImportFields.length > 0 && <div style={{ fontSize: 11, color: '#1677ff', marginBottom: 8 }}>📋 管理员限制可导入字段：{permImportFields.map(f => { const tf = tableFields.find((t: any) => t.name === f); return (tf?.uiSchema?.title || f) + '(' + f + ')'; }).join(', ')}</div>}
                  <Table
                    dataSource={(permImportFields.length > 0 ? tableFields.filter((f: any) => permImportFields.includes(f.name) || permUniqueFields.includes(f.name) || permRequiredFields.includes(f.name)) : tableFields).map((f: any, i: number) => ({ field: f, key: i }))}
                    columns={[
                      {
                        title: 'Excel列 / 自定义值',
                        width: 220,
                        render: (record: any) => {
                          const isUpdatedAt = record.field?.interface === 'updatedAt';
                          const val = fieldMapping[record.field.name];
                          const isCustom = val === '__custom__';
                          const used = Object.values(fieldMapping).filter(v => v && v !== '__ignore__' && v !== '__custom__');
                          return (
                            <div>
                              {isUpdatedAt ? (
                                <span style={{ color: '#999', lineHeight: '32px' }}>—</span>
                              ) : (
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
                              )}
                              {isCustom && !isUpdatedAt && (
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
                          if (record.field?.interface === 'updatedAt') return <Tag color="orange">🔒 只读</Tag>;
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
                            {permRequiredFields.includes(record.field.name) && <Tag color="volcano" style={{ marginLeft: 4, fontSize: 10 }}>⚠ 必填</Tag>}
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
                 if (uniqueFields.some(uf => !fieldMapping[uf] || fieldMapping[uf] === '__ignore__')) return true;
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
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>📋 预览确认 — 导入到的数据表：{(selectedTable?.title || selectedTable?.name)}（{selectedTable?.name}）</div>
           <Card size="small" style={{ marginBottom: 16 }}>
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 12 }}>
               <div><span style={{ color: '#999' }}>📁 文件：</span><Tag color="blue">{uploadedFileName}</Tag></div>
               <div><span style={{ color: '#999' }}>📄 Sheet：</span><span>{sheetName}</span></div>
               <div><span style={{ color: '#999' }}>📊 模式：</span>
                 <Tag color="orange">{importMode === 'insert' ? '新增' : importMode === 'update' ? '更新' : importMode === 'upsert' ? '新增+更新' : importMode}</Tag>
               </div>
               <div><span style={{ color: '#999' }}>📈 预计：</span><span>{previewData?.totalRows || 0} 行</span></div>
               <div><span style={{ color: '#999' }}>📋 表头行：</span><span>第 {headerRow} 行</span></div>
             </div>
             {uniqueFields.length > 0 && (
               <div style={{ marginTop: 8 }}>
                 <span style={{ color: '#666', fontSize: 12 }}>🔑 唯一值字段：</span>
                 <Space wrap size={[4, 4]}>
                   {uniqueFields.map(f => {
                     const tf = tableFields.find((t: any) => t.name === f);
                     return <Tag key={f} color="orange">{(tf?.uiSchema?.title || f)}({f})</Tag>;
                   })}
                 </Space>
               </div>
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
                     cols.push({ title: (<div style={{ textAlign: 'center', lineHeight: 1.4 }}><div style={{ color: '#1677ff', fontSize: 11 }}>导入字段：自定义</div><div style={{ color: '#666', fontSize: 11 }}>数据表字段：{disp}({fieldName})</div></div>), dataIndex: fieldName });
                    } else if (excelCol && excelCol !== '__ignore__' && !seen.has(excelCol)) {
                      seen.add(excelCol);
                      cols.push({ title: (<div style={{ textAlign: 'center', lineHeight: 1.4 }}><div style={{ color: '#1677ff', fontSize: 11 }}>导入字段：{excelCol}</div><div style={{ color: '#666', fontSize: 11 }}>数据表字段：{disp}({fieldName})</div></div>), dataIndex: excelCol });
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
