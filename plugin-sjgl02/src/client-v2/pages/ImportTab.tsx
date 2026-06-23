import React, { useState, useEffect } from 'react';
import {
  Card, Steps, Button, Select, Table, Upload, Tag, Alert, Empty,
  Statistic, Row, Col, Space, Modal, message, Spin, InputNumber, Input,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { useAPIClient } from '@nocobase/client-v2';
import { NAMESPACE } from '../locale';

const { Dragger } = Upload;

const STEP_TITLES = ['选择数据表', '上传文件 & 字段映射', '预览 & 执行'];

const IMPORT_MODES = [
  { value: 'insert', label: '新增 (insert)' },
  { value: 'update', label: '更新 (update)' },
  { value: 'upsert', label: '新增+更新 (upsert)' },
];

type MappingType = 'excel' | 'custom' | 'ignore';

export default function ImportTab() {
  const api = useAPIClient();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [importMode, setImportMode] = useState('insert');
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [uniqueFields, setUniqueFields] = useState<string[]>([]);
  const [tableFields, setTableFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [headerRow, setHeaderRow] = useState(1);
  const [sheetName, setSheetName] = useState('Sheet1');
  const [availSheets, setAvailSheets] = useState<string[]>(['Sheet1']);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);

  const { data: tablesData, loading: tablesLoading } = useRequest(
    () => api.request({ url: 'sjgl02Permissions:tables', method: 'get' }),
    { onError: () => message.error(t('Load failed')) },
  );

  const rawTables = (tablesData as any)?.data?.data || [];
  const tables = (rawTables as any[]).map((item: any) => ({
    name: item.name,
    title: item.title || item.name,
  }));

  useEffect(() => {
    if (selectedTable?.name) {
      setLoading(true);
      api
        .request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: selectedTable.name } })
        .then((res: any) => {
          const data = res?.data?.data || [];
          setTableFields(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [selectedTable?.name, api, t]);

  const handleTableSelect = (value: string) => {
    const table = tables.find((t: any) => t.name === value);
    setSelectedTable(table || null);
    setFieldMapping({});
  };

  const handleUpload = (info: any) => {
    if (info.file.status === 'done') {
      const resp = info.file.response;
      const fileId = resp?.data?.data?.id || resp?.data?.id || resp?.id;
      if (fileId) {
        setUploadedFileId(fileId);
        setUploadFileName(info.file.name);
        message.success(`${info.file.name} 上传成功`);
        api.request({
          url: 'sjgl02Import:uploadParse',
          method: 'post',
          data: { fileId },
        }).then((res: any) => {
          const d = res?.data?.data;
          if (d) {
            if (d.sheets) setAvailSheets(d.sheets);
            if (d.headerColumns) setExcelHeaders(d.headerColumns);
            if (d.sheets?.[0]) setSheetName(d.sheets[0]);
          }
            }).catch(() => { setExcelHeaders([]); setAvailSheets(['Sheet1']); });
      } else {
        message.error('上传响应中未找到文件ID');
      }
    } else if (info.file.status === 'error') {
      message.error('上传失败，请重试');
    }
  };

  const handleRefreshHeaders = async () => {
    if (!uploadedFileId) return;
    try {
      const res = await api.request({
        url: 'sjgl02Import:uploadParse',
        method: 'post',
        data: { fileId: uploadedFileId },
      });
      const d = res?.data?.data;
      if (d?.headerColumns) {
        setExcelHeaders(d.headerColumns);
        if (d.sheets) setAvailSheets(d.sheets);
        message.success('表头已刷新');
      }
    } catch { message.error('刷新失败'); }
  };

  const usedExcelCols = Object.entries(fieldMapping)
    .filter(([, v]) => v && v !== '__ignore__')
    .map(([, v]) => v);

  const getMappingType = (fieldName: string): MappingType => {
    const v = fieldMapping[fieldName];
    if (!v || v === '__ignore__') return 'ignore';
    if (v === '__custom__') return 'custom';
    return 'excel';
  };

  const canGoStep2 = !!uploadedFileId;

  const handleAutoMatch = () => {
    const mapping: Record<string, string> = {};
    tableFields.forEach((f) => {
      const match = excelHeaders.find((h: string) =>
        h.toLowerCase() === f.name.toLowerCase() ||
        (f.uiSchema?.title && h.toLowerCase() === f.uiSchema.title.toLowerCase())
      );
      if (match) mapping[f.name] = match;
    });
    setFieldMapping(mapping);
    message.success('自动匹配完成');
  };

  const handlePreview = async () => {
    if (!uploadedFileId) return;
    try {
      const res = await api.request({
        url: 'sjgl02Import:preview',
        method: 'get',
        params: { fileId: uploadedFileId, sheetName, headerRow },
      });
      const data = res?.data?.data ?? null;
      setPreviewData(data || null);
    } catch {
      message.error('预览失败');
    }
  };

  const handleExecuteImport = () => {
    Modal.confirm({
      title: t('Confirm operation'),
      content: '导入在单一事务中执行，任一数据行失败则整批回滚。',
      onOk: async () => {
        setExecuting(true);
        try {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(fieldMapping)) {
            if (v === '__custom__') {
              mapped[k] = customValues[k] ?? '';
            } else {
              mapped[k] = v;
            }
          }
          await api.request({
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
          });
          message.success(t('Saved successfully'));
          setTimeout(() => {
            setCurrentStep(0); setSelectedTable(null); setUploadedFileId(null);
            setUploadFileName(''); setFieldMapping({}); setPreviewData(null);
            setCustomValues({});
          }, 1500);
        } catch {
          message.error(t('Save failed'));
        } finally {
          setExecuting(false);
        }
      },
    });
  };

  const mappedCount = Object.values(fieldMapping).filter((v) => v && v !== '__ignore__').length;
  const ignoredCount = Object.values(fieldMapping).filter((v) => !v || v === '__ignore__').length;
  const usedCount = usedExcelCols.length;

  return (
    <div>
      <Steps current={currentStep} items={STEP_TITLES.map((title) => ({ title }))} style={{ marginBottom: 28 }} />

      {currentStep === 0 && (
        <div>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="📋 选择目标数据表" size="small">
                <Select style={{ width: '100%' }} placeholder="— 请选择数据表 —"
                  onChange={handleTableSelect} value={selectedTable?.name} loading={tablesLoading}
                  showSearch optionFilterProp="label"
                  options={tables.map((t: any) => ({ value: t.name, label: `📁 ${t.title} (${t.name})` }))} />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>共 {tables.length} 张数据表</div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="ℹ️ 导入说明" size="small">
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
                  <p>• 支持 <strong>.xlsx</strong> / <strong>.xls</strong> / <strong>.csv</strong> 格式</p>
                  <p>• 文件最大 <strong>50 MB</strong></p>
                  <p>• 三种导入模式：<Tag color="blue">新增</Tag> <Tag color="green">更新</Tag> <Tag color="orange">新增+更新</Tag></p>
                  <p>• 导入在<strong>单一事务</strong>中执行，任一失败则整批回滚</p>
                </div>
              </Card>
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button type="primary" disabled={!selectedTable} onClick={() => setCurrentStep(1)}>下一步 →</Button>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>目标表：{selectedTable?.title || '—'}</div>
          {!uploadedFileId ? (
            <Dragger name="file" multiple={false} accept=".xlsx,.xls,.csv"
              action="/api/attachments:create" onChange={handleUpload}
              beforeUpload={(file) => {
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (!['xlsx', 'xls', 'csv'].includes(ext || '')) { message.error('不支持的文件格式'); return Upload.LIST_IGNORE; }
                if (file.size > 50 * 1024 * 1024) { message.error('文件超过 50MB 限制'); return Upload.LIST_IGNORE; }
                return true;
              }}
              style={{ marginBottom: 20 }}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">{t('Click or drag to upload')}</p>
              <p className="ant-upload-hint">{t('Supported formats')}</p>
            </Dragger>
          ) : (
            <div>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space><Tag color="blue">{uploadFileName}</Tag>
                  <Button size="small" onClick={() => { setUploadedFileId(null); setUploadFileName(''); setFieldMapping({}); setExcelHeaders([]); }}>重新上传</Button>
                </Space>
              </Card>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space wrap>
                  <span style={{ color: '#999' }}>Sheet名称：</span>
                  <Select value={sheetName} onChange={setSheetName} style={{ width: 150 }}
                    options={availSheets.map(s => ({ value: s, label: s }))} />
                  <span style={{ color: '#999' }}>表头行：</span>
                  <InputNumber min={1} max={100} value={headerRow} onChange={v => setHeaderRow(v || 1)} style={{ width: 80 }} />
                  <Button size="small" onClick={handleRefreshHeaders}>🔄 刷新</Button>
                </Space>
              </Card>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space style={{ marginBottom: 12 }}>
                  <span style={{ color: '#999' }}>导入模式：</span>
                  <Select value={importMode} onChange={setImportMode} style={{ width: 220 }}
                    options={IMPORT_MODES.map((m) => ({ value: m.value, label: m.label }))} />
                </Space>
                {(importMode === 'update' || importMode === 'upsert') && (
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>🔑 唯一值字段</div>
                    <Select mode="multiple" value={uniqueFields} onChange={setUniqueFields}
                      style={{ width: '100%' }} placeholder="选择唯一值字段"
                      options={tableFields.map((f: any) => ({ value: f.name, label: f.name }))} />
                  </div>
                )}
              </Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  📊 字段映射
                  <span style={{ color: '#999', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                    （共{tableFields.length}字段/已映射{mappedCount}/忽略{ignoredCount}；Excel列共{excelHeaders.length}/已用{usedCount}/剩余{excelHeaders.length - usedCount}）
                  </span>
                </div>
                <Button size="small" onClick={handleAutoMatch}>⚡ 自动匹配</Button>
              </div>
              {loading ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div> : (
                <Table
                  dataSource={tableFields.map((f: any, idx: number) => ({ field: f, key: idx }))}
                  columns={[
                    {
                      title: <span>Excel列 <Tag color="blue" style={{ fontSize: 10 }}>选择来源</Tag></span>,
                      width: 220,
                      render: (record: any) => {
                        const t = getMappingType(record.field.name);
                        return (
                          <div>
                            <Select style={{ width: '100%' }} placeholder="未选择（忽略）"
                              value={fieldMapping[record.field.name]}
                              onChange={(val) => {
                                setFieldMapping(prev => ({ ...prev, [record.field.name]: val }));
                                if (val === '__custom__' && !customValues[record.field.name]) {
                                  setCustomValues(prev => ({ ...prev, [record.field.name]: '' }));
                                }
                              }}
                              allowClear>
                              <Select.Option value="__ignore__">🚫 忽略此字段</Select.Option>
                              <Select.Option value="__custom__">✏️ 自定义固定值</Select.Option>
                              {excelHeaders.map((h: string) => (
                                <Select.Option key={h} value={h}
                                  disabled={usedExcelCols.includes(h) && fieldMapping[record.field.name] !== h}>
                                  📋 {h} {usedExcelCols.includes(h) && fieldMapping[record.field.name] !== h ? '(已使用)' : ''}
                                </Select.Option>
                              ))}
                            </Select>
                            {t === 'custom' && (
                              <Input size="small" style={{ marginTop: 4 }}
                                placeholder="输入固定值"
                                value={customValues[record.field.name] || ''}
                                onChange={e => setCustomValues(prev => ({ ...prev, [record.field.name]: e.target.value }))} />
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      title: '映射方式',
                      width: 80,
                      render: (record: any) => {
                        const t = getMappingType(record.field.name);
                        return t === 'excel' ? <Tag color="blue">Excel列</Tag>
                          : t === 'custom' ? <Tag color="green">固定值</Tag>
                          : <Tag>忽略</Tag>;
                      },
                    },
                    { title: '→', width: 30, render: () => <span style={{ color: '#999' }}>→</span> },
                    {
                      title: <span>工作表字段 <Tag color="green" style={{ fontSize: 10 }}>目标字段</Tag></span>,
                      render: (record: any) => (
                        <span>
                          {record.field.isRequired && <span style={{ color: '#ff4d4f' }}>* </span>}
                          {record.field.uiSchema?.title || record.field.name}({record.field.name})
                          {['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(record.field.type) && (
                            <Tag color="purple" style={{ fontSize: 10, marginLeft: 4 }}>关联</Tag>)}
                        </span>
                      ),
                    },
                  ] as any}
                  pagination={false} size="small" />
              )}
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={() => setCurrentStep(0)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={async () => { await handlePreview(); setCurrentStep(2); }} disabled={!canGoStep2}>下一步 →</Button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, margin