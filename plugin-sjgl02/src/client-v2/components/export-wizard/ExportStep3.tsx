import React, { useState } from 'react';
import { App, Button, Card, Modal, Tag } from 'antd';
import { useT } from '../../locale';
import { useApi } from '../../services/api';
import { ExportWizardState } from './ExportWizard';

function ts(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export default function ExportStep3({
  state,
  patch,
  onPrev,
  onDone,
}: {
  state: ExportWizardState;
  patch: (p: Partial<ExportWizardState>) => void;
  onPrev: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fileName = state.allTables
    ? `${t('全部数据表（含系统表）')}-${ts()}.tar.gz`
    : `${state.collection?.title}-${state.collection?.name}-${ts()}.xlsx`;

  const submit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const filter =
        state.dataRange === 'filtered' && state.filters.length
          ? { $and: state.filters.filter((f) => f.field && f.value !== '').map((f) => ({ [f.field]: { [f.op]: f.value } })) }
          : undefined;
      await api.submitExport({
        collectionName: state.allTables ? undefined : state.collection?.name,
        allTables: state.allTables || undefined,
        fields: state.allTables
          ? []
          : state.selectedFields.map((field) => ({
              field,
              dateFormat: state.dateFormats[field],
              relationFormat: state.relationFormats[field],
            })),
        headerType: state.headerType,
        filter,
        relationFields: state.relationExportEnabled ? state.relationFields : [],
        relationExportMode: state.relationExportMode,
        exportAttachment: state.exportAttachment,
        globalDateFormat: state.globalDateFormat,
        globalRelationFormat: state.globalRelationFormat,
        permissionConfigId: state.permission?.id ?? null,
      });
      message.success(t('导出任务已提交！请到「任务管理」Tab 查看'));
      onDone();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const singleCards: Array<[string, React.ReactNode]> = [
    [t('选择字段数'), <strong style={{ fontSize: 18, color: '#1677ff' }}>{state.selectedFields.length}</strong>],
    [t('导出数据表'), `${state.collection?.title}(${state.collection?.name})`],
    [t('数据范围'), state.dataRange === 'all' ? t('全部数据') : `${t('自定义条件')}（${state.filters.length}）`],
    [t('表头格式'), state.headerType === 'titleName' ? t('字段名称(字段名)') : state.headerType === 'title' ? t('字段名称') : t('字段名')],
    [t('关联表导出'), state.relationExportEnabled ? (state.relationExportMode === 'sheet' ? t('单独Sheet') : t('单独xlsx文件')) : t('不导出')],
    [t('导出附件'), state.exportAttachment ? t('是 (tar.gz)') : t('否')],
    [t('百万行分文件'), t('自动开启')],
    [t('导出格式'), 'xlsx (固定)'],
  ];

  const allCards: Array<[string, React.ReactNode]> = [
    [t('导出范围'), t('含系统表')],
    [t('打包格式'), 'tar.gz'],
    [t('导出附件'), state.exportAttachment ? t('是') : t('否')],
    [t('导出格式'), t('xlsx (每表独立)')],
    [t('日期格式（全局）'), state.globalDateFormat],
    [t('关联格式（全局）'), state.globalRelationFormat],
  ];

  return (
    <div>
      <h4 style={{ marginBottom: 16 }}>{t('执行导出')} - {state.collection?.title}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, marginBottom: 16 }}>
        {(state.allTables ? allCards : singleCards).map(([label, value]) => (
          <Card key={label} size="small">
            <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
          </Card>
        ))}
      </div>

      {!state.allTables && (
        <Card size="small" title={`🏷️ ${t('选中字段')}`} style={{ marginBottom: 12 }}>
          {state.selectedFields.map((f) => {
            const meta = state.meta?.fields.find((x) => x.name === f);
            return <Tag key={f} color="blue">{meta ? `${meta.title}(${f})` : f}</Tag>;
          })}
        </Card>
      )}

      <div style={{ padding: '8px 12px', background: '#f0f5ff', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
        📁 {t('导出文件名')}：<strong>{fileName}</strong>
        {!state.allTables && (
          <>
            <br />
            <span style={{ color: '#999' }}>{t('格式: 数据表名称-数据表标识-年月日时分秒')}</span>
          </>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <Button onClick={onPrev}>← {t('上一步')}</Button>{' '}
        <Button type="primary" loading={submitting} disabled={submitting} onClick={() => setConfirmOpen(true)}>
          ▶ {t('执行导出')}
        </Button>
      </div>

      <Modal
        title={`⚠️ ${t('确认导出')}`}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={submit}
        okText={t('确认')}
        cancelText={t('取消')}
        confirmLoading={submitting}
      >
        <p style={{ lineHeight: 1.9 }}>
          {state.allTables ? t('将导出全部数据表（含系统表）为 tar.gz 包。') : t('将导出所选字段数据到 Excel 文件。')}
          <br />
          {t('文件名')}：<strong>{fileName}</strong>
        </p>
      </Modal>
    </div>
  );
}
