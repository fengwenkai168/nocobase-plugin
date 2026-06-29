import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Steps, Button, Select, Tag, Alert,
  Statistic, Row, Col, Space, Switch, Input, Checkbox, Modal, message, Progress,
} from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { useAPIClient } from '@nocobase/client-v2';
import { NAMESPACE } from '../locale';

const STEP_TITLES = ['选择数据表', '选择字段 & 配置', '执行导出'];

export default function ExportTab() {
  const api = useAPIClient();
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [isAllTables, setIsAllTables] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [includeAssocSheet, setIncludeAssocSheet] = useState(false);
  const [selectedAssocTables, setSelectedAssocTables] = useState<string[]>([]);
  const [dataRange, setDataRange] = useState<'all' | 'filtered'>('all');
  const [exportProgress, setExportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [downloadTaskId, setDownloadTaskId] = useState<number | null>(null);
  const [fileNameTemplate, setFileNameTemplate] = useState('{表名}_{日期}.xlsx');
  const [allFileNameTemplate, setAllFileNameTemplate] = useState('全部数据表_{日期}.zip');
  const [exportFields, setExportFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [estimatedRows, setEstimatedRows] = useState<number | null>(null);
  const [assocDisplayMode, setAssocDisplayMode] = useState<Record<string, string>>({});
  const [filterConditions, setFilterConditions] = useState<Array<{ field: string; op: string; value: string }>>([]);

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
    if (selectedTable?.name && selectedTable.name !== '__all__') {
      setLoading(true);
      api.request({ url: 'sjgl02Export:tableFields', method: 'get', params: { tableName: selectedTable.name } })
        .then((res: any) => {
          const fields = (res?.data?.data || []).map((f: any) => ({ ...f, displayName: f.name }));
          setExportFields(fields);
          const names = (fields as any[]).map((f: any) => f.displayName);
          setSelectedFields(names);
          const defaultModes: Record<string, string> = {};
          fields.forEach((f: any) => {
            if (['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type)) {
              defaultModes[f.name] = '显示值';
            }
          });
          setAssocDisplayMode(prev => ({ ...defaultModes, ...prev }));
        }).catch(() => message.error(t('Load failed'))).finally(() => setLoading(false));
      api.request({ url: 'sjgl02Export:previewCount', method: 'post', data: { tableName: selectedTable.name } })
        .then((res: any) => { const c = res?.data?.data?.estimatedRows; if (typeof c === 'number') setEstimatedRows(c); }).catch(() => {});
    } else if (selectedTable?.name === '__all__') {
      api.request({ url: 'sjgl02Export:previewCount', method: 'post', data: { tableName: '__all__' } })
        .then((res: any) => { const c = res?.data?.data?.estimatedRows; if (typeof c === 'number') setEstimatedRows(c); }).catch(() => {});
    }
  }, [selectedTable?.name, api, t]);

  const regularFields = exportFields.filter((f) => !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany', 'attachment'].includes(f.type) && !f.isForeignKey);
  const associationFields = exportFields.filter((f) => ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type));
  const attachmentFields = exportFields.filter((f) => f.type === 'attachment');
  const fkFields = exportFields.filter((f) => f.isForeignKey);
  const totalFieldCount = exportFields.length;

  const handleTableSelect = (value: string) => {
    setIsAllTables(value === '__all__');
    setSelectedTable(value === '__all__' ? { name: '__all__', title: '全部数据表' } : tables.find((t: any) => t.name === value) || null);
  };

  const toggleField = (fieldName: string) => setSelectedFields(prev => prev.includes(fieldName) ? prev.filter(f => f !== fieldName) : [...prev, fieldName]);
  const handleSelectAll = () => setSelectedFields(selectedFields.length === totalFieldCount ? [] : exportFields.map(f => f.displayName));
  const isFieldSelected = (name: string) => selectedFields.includes(name);

  const handleExecuteExport = () => {
    if (exporting) return;
    Modal.confirm({
      title: t('Confirm operation'),
      content: isAllTables ? '将生成 .zip 压缩包' : '将生成 .xlsx 文件',
      onOk: async () => {
        setExporting(true); setExportProgress(0); setExportDone(false);
        try {
          const execRes = await api.request({
            url: 'sjgl02Export:execute', method: 'post',
            data: {
              tableName: selectedTable?.name, selectedFields,
              includeAssociationSheet: includeAssocSheet,
              associationSheetTables: selectedAssocTables,
              includeAttachments,
              associationDisplayMode: assocDisplayMode,
              filter: dataRange === 'all' ? undefined : filterConditions,
              fileNameTemplate: isAllTables ? allFileNameTemplate : fileNameTemplate,
            },
          });
          const taskId = execRes?.data?.data?.taskId;
          if (taskId) {
            setDownloadTaskId(taskId);
            let pollCount = 0; const maxPolls = 45;
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(async () => {
              if (!mountedRef.current) { clearInterval(timerRef.current!); return; }
              pollCount++;
              try {
                const pr = await api.request({ url: 'sjgl02Export:progress', method: 'get', params: { taskId } });
                if (!mountedRef.current) return;
                const pg = pr?.data?.data;
                if (pg) {
                  setExportProgress(pg.progress || 0);
                  if (pg.status === 'completed') { clearInterval(timerRef.current!); setExportDone(true); setExporting(false); message.success(t('Saved successfully')); }
                  else if (pg.status === 'failed') { clearInterval(timerRef.current!); setExporting(false); message.error(t('Save failed')); }
                }
                if (pollCount >= maxPolls) { clearInterval(timerRef.current!); setExporting(false); message.error('导出超时'); }
              } catch { clearInterval(timerRef.current!); setExporting(false); message.error(t('Save failed')); }
            }, 2000);
          } else {
            message.warning('未获取到任务ID'); setExporting(false);
          }
        } catch { message.error(t('Save failed')); setExporting(false); }
      },
    });
  };

  const handleDownload = async () => {
    if (!downloadTaskId) { message.warning('无可用任务ID'); return; }
    try {
      const res = await api.request({ url: 'sjgl02Export:download', method: 'get', params: { taskId: downloadTaskId }, responseType: 'blob' });
      const disp = res.headers?.['content-disposition'] || '';
      const m = disp.match(/filename\*=UTF-8''(.+)|filename="?([^";]+)/);
      const name = m ? decodeURIComponent(m[1] || m[2] || 'export.xlsx') : 'export.xlsx';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch { message.error('下载失败'); }
  };

  return (
    <div>
      <Steps current={currentStep} items={STEP_TITLES.map((title) => ({ title }))} style={{ marginBottom: 28 }} />
      {currentStep === 0 && (
        <div>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="📋 选择数据表" size="small">
                <Select style={{ width: '100%' }} placeholder="— 请选择数据表 —" onChange={handleTableSelect}
                  value={selectedTable?.name} loading={tablesLoading} showSearch optionFilterProp="label"
                  options={[{ value: '__all__', label: <span style={{ fontWeight: 600, color: '#1677ff' }}>📦 全部数据表（含系统表）</span> },
                    ...tables.map((t: any) => ({ value: t.name, label: `📁 ${t.title} (${t.name})` }))]} />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>共 {tables.length + 1} 个选项</div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="⚙️ 简要配置" size="small">
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
                  <p>• 支持全字段选择和自定义筛选</p><p>• 关联字段可选「显示值」或「仅ID」</p>
                  <p>• 支持生成关联数据独立 Sheet</p><p>• 自定义文件名模板</p>
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
          {isAllTables ? (
            <div>
              <Alert type="info" showIcon message={t('All tables export warning')} style={{ marginBottom: 12 }} />
              <Card title="📦 全部数据表导出" size="small">
                <p>✅ 将导出系统中 <strong>所有数据表</strong></p><p>📦 最终打包为 <strong>ZIP 压缩包</strong> 下载</p>
                <p>📋 包含以下 {tables.length} 张表：</p>
                <Space wrap>{tables.slice(0, 8).map((tbl: any) => <Tag key={tbl.name} color="blue">{tbl.title}</Tag>)}</Space>
              </Card>
              <Card title="⚙️ 导出配置" size="small" style={{ marginTop: 12 }}>
                <Space><span style={{ color: '#999' }}>文件命名规则：</span>
                  <Input style={{ width: 280 }} value={allFileNameTemplate} onChange={e => setAllFileNameTemplate(e.target.value)} /></Space>
              </Card>
            </div>
          ) : loading ? <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div> : (
            <div>
              <Card title="☑️ 字段选择" size="small" style={{ marginBottom: 12 }}>
                <Checkbox indeterminate={selectedFields.length > 0 && selectedFields.length < totalFieldCount}
                  checked={selectedFields.length === totalFieldCount && totalFieldCount > 0} onChange={handleSelectAll}>
                  {t('Select all')} <span style={{ color: '#999', fontSize: 12 }}>{t('Selected')}: {selectedFields.length}/{totalFieldCount}</span>
                </Checkbox>
                {regularFields.length > 0 && <><div style={{ fontWeight: 600, fontSize: 12, marginTop: 12, marginBottom: 6 }}>📄 {t('Regular fields')} ({regularFields.length})</div>
                  <Space wrap style={{ marginBottom: 12 }}>{regularFields.map(f => <Checkbox key={f.name} checked={isFieldSelected(f.displayName)} onChange={() => toggleField(f.displayName)}>{(f.uiSchema?.title || f.name) + '(' + f.name + ')'}</Checkbox>)}</Space></>}
                {associationFields.length > 0 && <><div style={{ fontWeight: 600, fontSize: 12, color: '#7c3aed', marginBottom: 6 }}>🔗 {t('Association fields')} ({associationFields.length})</div>
                  <Space wrap style={{ marginBottom: 12 }}>{associationFields.map(f => <Checkbox key={f.name} checked={isFieldSelected(f.displayName)} onChange={() => toggleField(f.displayName)}>{(f.uiSchema?.title || f.name) + '(' + f.name + ')'}</Checkbox>)}</Space></>}
                {attachmentFields.length > 0 && <><div style={{ fontWeight: 600, fontSize: 12, color: '#0891b2', marginBottom: 6 }}>📎 {t('Attachment fields')} ({attachmentFields.length})</div>
                  <Space wrap>{attachmentFields.map(f => <Checkbox key={f.name} checked={isFieldSelected(f.displayName)} onChange={() => toggleField(f.displayName)}>{(f.uiSchema?.title || f.name) + '(' + f.name + ')'}</Checkbox>)}</Space></>}
                {fkFields.length > 0 && <><div style={{ fontWeight: 600, fontSize: 12, color: '#d97706', marginBottom: 6 }}>🔑 关联主键 ({fkFields.length})</div>
                  <Space wrap>{fkFields.map(f => <Checkbox key={f.name} checked={isFieldSelected(f.displayName)} onChange={() => toggleField(f.displayName)}>{(f.uiSchema?.title || f.name) + '(' + f.name + ')'}</Checkbox>)}</Space></>}
              </Card>
              {associationFields.length > 0 && (
                <Card title="🔗 关联字段显示模式" size="small" style={{ marginBottom: 12 }}>
                  <Space wrap>{associationFields.filter(f => isFieldSelected(f.displayName)).map(f => (
                    <Space key={f.name}><span>{f.displayName}</span>
                      <Select value={assocDisplayMode[f.name] || '显示值'} onChange={val => setAssocDisplayMode(prev => ({ ...prev, [f.name]: val }))}
                        style={{ width: 100 }} options={[{ value: '显示值', label: '显示值' }, { value: '仅ID', label: '仅ID' }]} /></Space>))}</Space>
                </Card>
              )}
              <Card title="📑 关联数据 Sheet" size="small" style={{ marginBottom: 12 }}>
                <Space><Switch checked={includeAssocSheet} onChange={setIncludeAssocSheet} /><span>{t('Include association sheet')}</span></Space>
                {includeAssocSheet && associationFields.filter(f => isFieldSelected(f.displayName)).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Select mode="multiple" style={{ width: '100%' }} placeholder="选择要包含的关联表"
                      value={selectedAssocTables} onChange={setSelectedAssocTables}
                      options={associationFields.filter(f => isFieldSelected(f.displayName)).map(f => ({ value: f.name, label: f.displayName }))} />
                  </div>
                )}
              </Card>
              <Card title="📊 数据范围" size="small" style={{ marginBottom: 12 }}>
                <Space style={{ marginBottom: 12 }}>
                  <Button type={dataRange === 'all' ? 'primary' : 'default'} onClick={() => setDataRange('all')}>{t('All data')}</Button>
                  <Button type={dataRange === 'filtered' ? 'primary' : 'default'} onClick={() => setDataRange('filtered')}>{t('Custom filter')}</Button>
                </Space>
                {dataRange === 'filtered' && (
                  <div>
                    {filterConditions.map((cond, i) => (
                      <Space key={i} style={{ marginBottom: 8 }}>
                        <Select style={{ width: 150 }} placeholder="字段" value={cond.field}
                          onChange={val => setFilterConditions(prev => prev.map((c, j) => j === i ? { ...c, field: val } : c))}
                          options={exportFields.map(f => ({ value: f.name, label: f.displayName }))} />
                        <Select style={{ width: 100 }} value={cond.op} onChange={val => setFilterConditions(prev => prev.map((c, j) => j === i ? { ...c, op: val } : c))}
                          options={[{ value: 'eq', label: '等于' }, { value: 'contains', label: '包含' }, { value: 'gt', label: '大于' }, { value: 'lt', label: '小于' }]} />
                        <Input style={{ width: 160 }} placeholder="值" value={cond.value} onChange={e => setFilterConditions(prev => prev.map((c, j) => j === i ? { ...c, value: e.target.value } : c))} />
                        <Button size="small" danger onClick={() => setFilterConditions(prev => prev.filter((_, j) => j !== i))}>删除</Button>
                      </Space>
                    ))}
                    <Button size="small" type="dashed" onClick={() => setFilterConditions(prev => [...prev, { field: '', op: 'eq', value: '' }])}>+ 添加条件</Button>
                  </div>
                )}
              </Card>
              <Card title="⚙️ 高级选项" size="small">
                <Space><span style={{ color: '#999' }}>文件命名：</span><Input style={{ width: 280 }} value={fileNameTemplate} onChange={e => setFileNameTemplate(e.target.value)} /></Space>
                <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>支持 <code>{'{表名}'}</code> <code>{'{日期}'}</code></div>
                <Space style={{ marginTop: 12 }}><Switch checked={includeAttachments} onChange={setIncludeAttachments} /><span>{t('Include attachments')}</span></Space>
              </Card>
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={() => setCurrentStep(0)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={() => setCurrentStep(2)} disabled={!selectedTable || (!isAllTables && selectedFields.length === 0)}>下一步 →</Button>
          </div>
        </div>
      )}
      {currentStep === 2 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>执行导出 — {selectedTable?.title}</div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {!isAllTables ? <>
              <Col span={6}><Card size="small"><Statistic title="选择字段" value={selectedFields.length} suffix="个" /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="预计导出行数" value={estimatedRows ?? '...'} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="文件命名" value={fileNameTemplate} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="生成格式" value={includeAttachments || attachmentFields.some(f => isFieldSelected(f.displayName)) ? '.zip' : '.xlsx'} /></Card></Col>
            </> : <>
              <Col span={6}><Card size="small"><Statistic title="导出表数量" value={tables.length} suffix="张" /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="预计总行数" value={estimatedRows ?? '...'} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="文件命名" value={allFileNameTemplate} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="生成文件" value=".zip" /></Card></Col>
            </>}
          </Row>
          {exporting && <Card size="small" style={{ marginBottom: 16, textAlign: 'center', padding: 20 }}><Progress type="circle" percent={exportProgress} /><div style={{ marginTop: 8, color: '#999' }}>正在导出...</div></Card>}
          {exportDone && <Alert type="success" showIcon message={<Space><span>{t('File ready for download')}</span><Button type="primary" size="small" onClick={handleDownload}>⬇ {t('Download')}</Button></Space>} style={{ marginBottom: 16 }} />}
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button onClick={() => setCurrentStep(1)} style={{ marginRight: 8 }} disabled={exporting}>← 上一步</Button>
            <Button type="primary" onClick={handleExecuteExport} loading={exporting} disabled={exportDone}>▶ 执行导出</Button>
          </div>
        </div>
      )}
    </div>
  );
}
