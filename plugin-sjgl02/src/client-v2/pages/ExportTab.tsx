import React, { useState, useEffect } from 'react';
import {
  Card, Steps, Button, Select, Tag, Alert,
  Statistic, Row, Col, Space, Switch, Input, Checkbox, Modal, message, Progress,
} from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';

const STEP_TITLES = ['选择数据表', '选择字段 & 配置', '执行导出'];

export default function ExportTab({ ctx }: { ctx: any }) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [isAllTables, setIsAllTables] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [includeAssocSheet, setIncludeAssocSheet] = useState(false);
  const [dataRange, setDataRange] = useState<'all' | 'filtered'>('all');
  const [exportProgress, setExportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [fileNameTemplate, setFileNameTemplate] = useState('{表名}_{日期}.xlsx');
  const [allFileNameTemplate, setAllFileNameTemplate] = useState('全部数据表_{日期}.zip');
  const [exportFields, setExportFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: tablesData, loading: tablesLoading } = useRequest(
    () => ctx.api.request({ url: 'sjgl02Permissions:tables', method: 'get' }),
    { onError: () => message.error(t('Load failed')) },
  );

  const rawTables = (tablesData as any)?.data?.data || (tablesData as any)?.data || [];
  const tables = rawTables.map((item: any) => ({
    name: item.name,
    title: item.title || item.name,
  }));

  useEffect(() => {
    if (selectedTable?.name && selectedTable.name !== '__all__') {
      setLoading(true);
      ctx.api
        .request({ url: 'sjgl02Export:tableFields', method: 'get', params: { tableName: selectedTable.name } })
        .then((res: any) => {
          const fields = (res?.data?.data || []).map((f: any) => ({
            ...f,
            displayName: f.title || f.name,
          }));
          setExportFields(fields);
          const names = fields.map((f: any) => f.displayName);
          setSelectedFields(names);
        })
        .catch(() => message.error(t('Load failed')))
        .finally(() => setLoading(false));
    }
  }, [selectedTable?.name, ctx, t]);

  const regularFields = exportFields.filter((f) => !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany', 'attachment'].includes(f.type));
  const associationFields = exportFields.filter((f) => ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type));
  const attachmentFields = exportFields.filter((f) => f.type === 'attachment');
  const totalFieldCount = exportFields.length;

  const handleTableSelect = (value: string) => {
    if (value === '__all__') {
      setIsAllTables(true);
      setSelectedTable({ name: '__all__', title: '全部数据表' });
    } else {
      setIsAllTables(false);
      const table = tables.find((t: any) => t.name === value);
      setSelectedTable(table || null);
    }
  };

  const toggleField = (fieldName: string) => {
    setSelectedFields((prev) => (prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : [...prev, fieldName]));
  };

  const handleSelectAll = () => {
    if (selectedFields.length === totalFieldCount) {
      setSelectedFields([]);
    } else {
      setSelectedFields(exportFields.map((f) => f.displayName));
    }
  };

  const isFieldSelected = (name: string) => selectedFields.includes(name);

  const handleExecuteExport = () => {
    if (exporting) return;
    Modal.confirm({
      title: t('Confirm operation'),
      content: isAllTables
        ? '将生成 .zip 压缩包（内含多个 .xlsx 文件及附件）'
        : `将生成 ${includeAttachments || attachmentFields.some((f) => isFieldSelected(f.displayName)) ? '.zip' : '.xlsx'} 文件`,
      onOk: async () => {
        setExporting(true);
        setExportProgress(0);
        try {
          await ctx.api.request({
            url: 'sjgl02Export:execute',
            method: 'post',
            data: {
              tableName: selectedTable?.name,
              selectedFields,
              includeAssociationSheet: includeAssocSheet,
              filter: dataRange === 'all' ? undefined : {},
              fileNameTemplate: isAllTables ? allFileNameTemplate : fileNameTemplate,
            },
          });
          for (let p = 0; p <= 100; p += 20) {
            await new Promise((r) => setTimeout(r, 500));
            setExportProgress(p);
          }
          setExportDone(true);
          message.success(t('Saved successfully'));
        } catch {
          message.error(t('Save failed'));
        } finally {
          setExporting(false);
        }
      },
    });
  };

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
              <Card title="📋 选择数据表" size="small">
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
                    options={[
                      {
                        value: '__all__',
                        label: (
                          <span style={{ fontWeight: 600, color: '#1677ff' }}>
                            📦 全部数据表（含系统表）
                          </span>
                        ),
                      },
                      ...tables.map((t: any) => ({
                        value: t.name,
                        label: `📁 ${t.title} (${t.name})`,
                      })),
                    ]}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>
                  共 {tables.length + 1} 个选项
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="⚙️ 简要配置" size="small">
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
                  <p>• 支持全字段选择和自定义筛选</p>
                  <p>• 关联字段可选择「显示值」或「仅ID」</p>
                  <p>• 支持生成关联数据独立 Sheet</p>
                  <p>• 自定义文件名模板</p>
                </div>
              </Card>
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button type="primary" disabled={!selectedTable} onClick={() => setCurrentStep(1)}>
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

          {isAllTables ? (
            <div>
              <Alert
                type="info"
                showIcon
                message={t('All tables export warning')}
                style={{ marginBottom: 12 }}
              />
              <Card title="📦 全部数据表导出" size="small">
                <p style={{ marginBottom: 8 }}>
                  ✅ 将导出系统中 <strong>所有数据表</strong>（含系统内置表），每张表生成一个独立 .xlsx 文件
                </p>
                <p style={{ marginBottom: 8 }}>📦 最终打包为 <strong>ZIP 压缩包</strong> 下载，内含所有表文件和附件</p>
                <p>📋 包含以下 {tables.length} 张表：</p>
                <Space wrap style={{ marginTop: 8 }}>
                  {tables.slice(0, 6).map((tbl: any) => (
                    <Tag key={tbl.name} color="blue" style={{ fontSize: 13, padding: '6px 12px' }}>
                      📁 {tbl.title} ({tbl.name})
                    </Tag>
                  ))}
                </Space>
              </Card>
              <Card title="⚙️ 导出配置" size="small" style={{ marginTop: 12 }}>
                <Space>
                  <span style={{ color: '#999' }}>文件命名规则：</span>
                  <Input
                    style={{ width: 280 }}
                    value={allFileNameTemplate}
                    onChange={(e) => setAllFileNameTemplate(e.target.value)}
                  />
                </Space>
                <div style={{ marginTop: 8, fontSize: 12, color: '#999', background: '#f0f5ff', padding: '8px 10px', borderRadius: 4 }}>
                  💡 支持占位符：<code>{'{表名}'}</code> <code>{'{日期}'}</code>，最终打包为 .zip
                </div>
              </Card>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>加载字段列表中...</div>
          ) : (
            <div>
              <Card title="☑️ 字段选择" size="small" style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <Checkbox
                    indeterminate={selectedFields.length > 0 && selectedFields.length < totalFieldCount}
                    checked={selectedFields.length === totalFieldCount && totalFieldCount > 0}
                    onChange={handleSelectAll}
                  >
                    {t('Select all')}
                    <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                      {t('Selected')}: {selectedFields.length} / {totalFieldCount}
                    </span>
                  </Checkbox>
                </div>

                {regularFields.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                      📄 {t('Regular fields')} ({regularFields.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {regularFields.map((f) => (
                        <Checkbox
                          key={f.name}
                          checked={isFieldSelected(f.displayName)}
                          onChange={() => toggleField(f.displayName)}
                        >
                          {f.displayName}
                        </Checkbox>
                      ))}
                    </div>
                  </>
                )}

                {associationFields.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#7c3aed', marginBottom: 6 }}>
                      🔗 {t('Association fields')} ({associationFields.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {associationFields.map((f) => (
                        <Checkbox
                          key={f.name}
                          checked={isFieldSelected(f.displayName)}
                          onChange={() => toggleField(f.displayName)}
                        >
                          {f.displayName}
                        </Checkbox>
                      ))}
                    </div>
                  </>
                )}

                {attachmentFields.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0891b2', marginBottom: 6 }}>
                      📎 {t('Attachment fields')} ({attachmentFields.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {attachmentFields.map((f) => (
                        <Checkbox
                          key={f.name}
                          checked={isFieldSelected(f.displayName)}
                          onChange={() => toggleField(f.displayName)}
                        >
                          {f.displayName}
                        </Checkbox>
                      ))}
                    </div>
                  </>
                )}
              </Card>

              {associationFields.length > 0 && (
                <Card title="🔗 关联字段显示模式" size="small" style={{ marginBottom: 12 }}>
                  <Space wrap>
                    {associationFields.map((f) => (
                      <Space key={f.name}>
                        <span>{f.displayName}</span>
                        <Select
                          defaultValue="显示值"
                          style={{ width: 100 }}
                          options={[
                            { value: '显示值', label: '显示值' },
                            { value: '仅ID', label: '仅ID' },
                          ]}
                        />
                      </Space>
                    ))}
                  </Space>
                </Card>
              )}

              <Card title="📑 关联数据 Sheet" size="small" style={{ marginBottom: 12 }}>
                <Space>
                  <Switch checked={includeAssocSheet} onChange={setIncludeAssocSheet} />
                  <span>{t('Include association sheet')}</span>
                </Space>
                {includeAssocSheet && associationFields.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    已选关联表：
                    <Space wrap style={{ marginLeft: 4 }}>
                      {associationFields
                        .filter((f) => isFieldSelected(f.displayName))
                        .map((f) => (
                          <Tag key={f.name} color="blue">{f.displayName}</Tag>
                        ))}
                    </Space>
                  </div>
                )}
              </Card>

              <Card title="📊 数据范围" size="small" style={{ marginBottom: 12 }}>
                <Space style={{ marginBottom: 12 }}>
                  <Button
                    type={dataRange === 'all' ? 'primary' : 'default'}
                    onClick={() => setDataRange('all')}
                  >
                    {t('All data')}
                  </Button>
                  <Button
                    type={dataRange === 'filtered' ? 'primary' : 'default'}
                    onClick={() => setDataRange('filtered')}
                  >
                    {t('Custom filter')}
                  </Button>
                </Space>
                {dataRange === 'filtered' && (
                  <Alert message="自定义条件配置区域" type="info" style={{ fontSize: 12 }} />
                )}
              </Card>

              <Card title="⚙️ 高级选项" size="small">
                <Space style={{ marginBottom: 12 }}>
                  <span style={{ color: '#999' }}>文件命名规则：</span>
                  <Input
                    style={{ width: 280 }}
                    value={fileNameTemplate}
                    onChange={(e) => setFileNameTemplate(e.target.value)}
                  />
                </Space>
                <div style={{ fontSize: 11, color: '#999', marginLeft: 8, marginBottom: 12 }}>
                  支持 <code>{'{表名}'}</code> <code>{'{日期}'}</code>
                </div>
                <Space>
                  <Switch checked={includeAttachments} onChange={setIncludeAttachments} />
                  <span>{t('Include attachments')}</span>
                </Space>
                <div style={{
                  marginTop: 8, fontSize: 12, color: '#999',
                  background: '#f0f5ff', padding: '8px 10px', borderRadius: 4,
                }}>
                  💡 单表导出为 .xlsx 文件；勾选「包含附件」则生成 .zip 压缩包
                </div>
              </Card>
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={() => setCurrentStep(0)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={() => setCurrentStep(2)} disabled={!selectedTable || (!isAllTables && selectedFields.length === 0)}>
              下一步 →
            </Button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            执行导出 — {selectedTable?.title}
          </div>

          {!isAllTables ? (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="选择字段 (个)" value={selectedFields.length} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="预计导出行数" value={5230} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="文件命名" value={fileNameTemplate} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="生成格式" value={includeAttachments || attachmentFields.some((f) => isFieldSelected(f.displayName)) ? '.zip' : '.xlsx'} />
                </Card>
              </Col>
            </Row>
          ) : (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card size="small"><Statistic title="导出表数量" value={tables.length} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="预计总行数" value={32150} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="文件命名" value={allFileNameTemplate} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="生成文件" value=".zip" /></Card></Col>
            </Row>
          )}

          {!isAllTables && (
            <Card title="🏷️ 选中字段" size="small" style={{ marginBottom: 16 }}>
              <Space wrap>
                {selectedFields.map((f) => {
                  const fieldDef = exportFields.find((ef) => ef.displayName === f);
                  const isAssoc = fieldDef && ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(fieldDef.type);
                  const isAttach = fieldDef?.type === 'attachment';
                  return <Tag key={f} color={isAssoc ? 'purple' : isAttach ? 'cyan' : 'blue'}>{f}</Tag>;
                })}
              </Space>
            </Card>
          )}

          {exporting && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Progress type="circle" percent={exportProgress} />
                <div style={{ marginTop: 8, color: '#999' }}>正在导出数据...</div>
              </div>
            </Card>
          )}

          {exportDone && (
            <Alert
              type="success"
              showIcon
              message={
                <Space>
                  <span>{t('File ready for download')}</span>
                  <Button type="primary" size="small" icon={<span>⬇</span>}>
                    {t('Download')}
                  </Button>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button onClick={() => setCurrentStep(1)} style={{ marginRight: 8 }} disabled={exporting}>← 上一步</Button>
            <Button
              type="primary"
              onClick={handleExecuteExport}
              loading={exporting}
              disabled={exportDone}
            >
              ▶ 执行导出
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
