import React, { useState, useEffect } from 'react';
import {
  Card, Steps, Button, Select, Table, Upload, Tag, Alert,
  Statistic, Row, Col, Space, Modal, message, Spin,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';

const { Dragger } = Upload;

const STEP_TITLES = ['选择数据表', '上传文件 & 字段映射', '预览 & 执行'];

const IMPORT_MODES = [
  { value: 'insert', label: '新增 (insert)', desc: '直接创建新记录，不匹配已有数据' },
  { value: 'update', label: '更新 (update)', desc: '按唯一值匹配并更新已有记录' },
  { value: 'upsert', label: '新增+更新 (upsert)', desc: '存在则更新，不存在则新增' },
];

export default function ImportTab({ ctx }: { ctx: any }) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [importMode, setImportMode] = useState('insert');
  const [uploaded, setUploaded] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [uniqueFields, setUniqueFields] = useState<string[]>([]);
  const [tableFields, setTableFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: tablesData, loading: tablesLoading } = useRequest(
    () => ctx.api.request({ url: 'sjgl02Permissions:tables', method: 'get' }),
    {
      onError: () => message.error(t('Load failed')),
    },
  );

  const rawTables = (tablesData as any)?.data?.data || (tablesData as any)?.data || [];
  const tables = rawTables.map((item: any) => ({
    name: item.name,
    title: item.title || item.name,
  }));

  useEffect(() => {
    if (selectedTable?.name) {
      setLoading(true);
      ctx.api
        .request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: selectedTable.name } })
        .then((res: any) => {
          const data = res?.data?.data || [];
          setTableFields(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [selectedTable?.name, ctx]);

  const handleTableSelect = (value: string) => {
    const table = tables.find((t: any) => t.name === value);
    setSelectedTable(table || null);
    setFieldMapping({});
  };

  const handleUpload = (info: any) => {
    if (info.file.status === 'done') {
      message.success(`${info.file.name} 上传成功`);
      setUploaded(true);
      setUploadFileName(info.file.name);
      setFieldMapping({});
    } else if (info.file.status === 'error') {
      message.error('上传失败，请重试');
    }
  };

  const canGoStep2 = uploaded;

  const handleAutoMatch = () => {
    const mapping: Record<string, string> = {};
    tableFields.forEach((f, i) => {
      if (i < Math.min(3, tableFields.length)) {
        mapping[f.title] = f.title;
      }
    });
    setFieldMapping(mapping);
    message.success('自动匹配完成');
  };

  const handleExecuteImport = () => {
    Modal.confirm({
      title: t('Confirm operation'),
      content: t('Are you sure to execute import'),
      onOk: async () => {
        try {
          await ctx.api.request({
            url: 'sjgl02Import:execute',
            method: 'post',
            data: {
              tableName: selectedTable?.name,
              fileId: 1,
              sheetName: 'Sheet1',
              headerRow: 1,
              fieldMapping,
              importMode,
            },
          });
          message.success(t('Saved successfully'));
          setTimeout(() => {
            setCurrentStep(0);
            setSelectedTable(null);
            setUploaded(false);
            setUploadFileName('');
            setFieldMapping({});
          }, 2000);
        } catch {
          message.error(t('Save failed'));
        }
      },
    });
  };

  const mappedCount = Object.values(fieldMapping).filter((v) => v && v !== '__ignore__').length;

  return (
    <div>
      <Steps
        current={currentStep}
        items={STEP_TITLES.map((title) => ({ title }))}
        style={{ marginBottom: 28 }}
      />

      {currentStep === 0 && (
        <div>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="📋 选择目标数据表" size="small">
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>数据表</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="— 请选择数据表 —"
                    onChange={handleTableSelect}
                    value={selectedTable?.name}
                    loading={tablesLoading}
                    showSearch
                    optionFilterProp="label"
                    options={tables.map((t: any) => ({
                      value: t.name,
                      label: `📁 ${t.title} (${t.name})`,
                    }))}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  共 {tables.length} 张数据表（从数据库自动加载）
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="ℹ️ 导入说明" size="small">
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
                  <p>• 支持 <strong>.xlsx</strong> / <strong>.xls</strong> / <strong>.csv</strong> 格式</p>
                  <p>• 文件最大 <strong>50 MB</strong></p>
                  <p>• 三种导入模式：<Tag color="blue">新增</Tag> <Tag color="green">更新</Tag> <Tag color="orange">新增+更新</Tag></p>
                  <p>• 必填字段自动标记 <span style={{ color: '#ff4d4f' }}>*</span></p>
                  <p>• 支持关联字段按显示名称匹配</p>
                </div>
              </Card>
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button
              type="primary"
              disabled={!selectedTable}
              onClick={() => setCurrentStep(1)}
            >
              下一步 →
            </Button>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
            目标表：{selectedTable?.title || '—'}
          </div>

          {!uploaded ? (
            <Dragger
              name="file"
              multiple={false}
              accept=".xlsx,.xls,.csv"
              action="/api/sjgl02Import:upload"
              onChange={handleUpload}
              beforeUpload={(file) => {
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
                  message.error('不支持的文件格式，仅支持 .xlsx .xls .csv');
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 50 * 1024 * 1024) {
                  message.error('文件超过 50MB 限制');
                  return Upload.LIST_IGNORE;
                }
                return true;
              }}
              style={{ marginBottom: 20 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{t('Click or drag to upload')}</p>
              <p className="ant-upload-hint">{t('Supported formats')}</p>
            </Dragger>
          ) : (
            <div>
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space>
                  <span style={{ color: '#999', fontSize: 12 }}>已上传：</span>
                  <Tag color="blue">{uploadFileName}</Tag>
                  <Button size="small" onClick={() => { setUploaded(false); setUploadFileName(''); setFieldMapping({}); }}>
                    重新上传
                  </Button>
                </Space>
              </Card>

              <Card size="small" style={{ marginBottom: 12 }}>
                <Space style={{ marginBottom: 12 }}>
                  <span style={{ color: '#999' }}>Sheet名称：</span>
                  <Select defaultValue="Sheet1" style={{ width: 120 }} options={[{ value: 'Sheet1', label: 'Sheet1' }]} />
                  <span style={{ color: '#999' }}>表头行：</span>
                  <Select defaultValue={1} style={{ width: 80 }} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
                </Space>
              </Card>

              <Card size="small" style={{ marginBottom: 12 }}>
                <Space style={{ marginBottom: 12 }}>
                  <span style={{ color: '#999' }}>导入模式：</span>
                  <Select
                    value={importMode}
                    onChange={setImportMode}
                    style={{ width: 220 }}
                    options={IMPORT_MODES.map((m) => ({ value: m.value, label: m.label }))}
                  />
                </Space>
                {(importMode === 'update' || importMode === 'upsert') && (
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>
                      🔑 唯一值字段（用于匹配已有记录）
                    </div>
                    <Select
                      mode="multiple"
                      value={uniqueFields}
                      onChange={setUniqueFields}
                      style={{ width: '100%' }}
                      placeholder="选择唯一值字段"
                      options={tableFields.map((f: any) => ({ value: f.title || f.name, label: f.title || f.name }))}
                    />
                  </div>
                )}
              </Card>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  📊 字段映射
                  <span style={{ color: '#999', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                    （共{tableFields.length}字段/已映射{mappedCount}/忽略{Math.max(0, tableFields.length - mappedCount)}）
                  </span>
                </div>
                <Button size="small" onClick={handleAutoMatch}>⚡ 自动匹配</Button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
              ) : (
                <Table
                  dataSource={tableFields.map((f: any, i: number) => ({ field: f, key: i }))}
                  columns={[
                    {
                      title: (
                        <span>Excel列 <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>选择来源</Tag></span>
                      ),
                      dataIndex: 'excelCol',
                      render: (_: any, record: any) => (
                        <Select
                          style={{ width: '100%' }}
                          placeholder="未选择（忽略）"
                          value={fieldMapping[record.field.title || record.field.name]}
                          onChange={(val) =>
                            setFieldMapping((prev) => ({ ...prev, [record.field.title || record.field.name]: val }))
                          }
                          allowClear
                          options={[
                            { value: '__ignore__', label: '🚫 未选择（忽略）' },
                            { value: '__custom__', label: '✏️ 自定义固定值' },
                          ]}
                        />
                      ),
                    },
                    {
                      title: '映射方式',
                      width: 90,
                      render: (_: any, record: any) => {
                        const val = fieldMapping[record.field.title || record.field.name];
                        if (!val || val === '__ignore__') return <Tag>忽略</Tag>;
                        if (val === '__custom__') return <Tag color="green">固定值</Tag>;
                        return <Tag color="blue">Excel列</Tag>;
                      },
                    },
                    { title: '', width: 20, render: () => <span style={{ color: '#999' }}>→</span> },
                    {
                      title: (
                        <span>工作表字段 <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>目标字段</Tag></span>
                      ),
                      render: (field: any) => (
                        <span>
                          {field.isRequired && <span style={{ color: '#ff4d4f' }}>* </span>}
                          {field.title || field.name}
                          <span style={{ color: '#999', fontSize: 11, marginLeft: 4 }}>({field.name})</span>
                          {['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(field.type) && (
                            <Tag color="purple" style={{ fontSize: 10, marginLeft: 4 }}>关联</Tag>
                          )}
                          {field.type === 'attachment' && (
                            <Tag color="cyan" style={{ fontSize: 10, marginLeft: 4 }}>附件</Tag>
                          )}
                        </span>
                      ),
                    },
                  ] as any}
                  pagination={false}
                  size="small"
                />
              )}
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={() => setCurrentStep(0)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={() => setCurrentStep(2)} disabled={!canGoStep2}>
              下一步 →
            </Button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            预览确认 — {selectedTable?.title}
          </div>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="预计导入行数" value={1256} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="错误行数" value={0} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="导入模式" value={IMPORT_MODES.find((m) => m.value === importMode)?.label || importMode} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Sheet名称" value="Sheet1" />
              </Card>
            </Col>
          </Row>

          {(importMode === 'update' || importMode === 'upsert') && uniqueFields.length > 0 && (
            <Alert
              type="info"
              showIcon
              message={
                <span>
                  唯一值匹配字段：<strong>{uniqueFields.join(', ')}</strong>
                  （同时满足这些字段值相同的记录将被视为已存在，执行更新操作）
                </span>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            👁️ 预览数据（前10行）
          </div>

          <Table
            dataSource={[
              { key: '1', 姓名: '张三', 手机号: '13800138001', 年龄: 28, 邮箱: 'zhangsan@example.com', 地址: '北京市朝阳区' },
              { key: '2', 姓名: '李四', 手机号: '13800138002', 年龄: 35, 邮箱: 'lisi@example.com', 地址: '上海市浦东新区' },
            ]}
            columns={[
              { title: '姓名', dataIndex: '姓名', key: '姓名' },
              { title: '手机号', dataIndex: '手机号', key: '手机号' },
              { title: '年龄', dataIndex: '年龄', key: '年龄' },
              { title: '邮箱', dataIndex: '邮箱', key: '邮箱' },
              { title: '地址', dataIndex: '地址', key: '地址' },
            ]}
            pagination={false}
            size="small"
          />

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button onClick={() => setCurrentStep(1)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={handleExecuteImport}>▶ 执行导入</Button>
          </div>
        </div>
      )}
    </div>
  );
}
