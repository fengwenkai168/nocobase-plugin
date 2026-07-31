import React, { useMemo, useState } from 'react';
import { App, Button, Card, Modal, Table, Tag } from 'antd';
import { useT } from '../../locale';
import { useApi } from '../../services/api';
import { ImportWizardState } from './ImportWizard';
import { modeLabel } from './modeLabels';
import { fieldLabel } from './field-utils';

export default function ImportStep3({
  state,
  patch,
  onPrev,
  onDone,
}: {
  state: ImportWizardState;
  patch: (p: Partial<ImportWizardState>) => void;
  onPrev: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const effectiveMapping = state.mapping.filter((m) => m.source !== 'ignore');
  const isUpMode = state.mode === 'update' || state.mode === 'upsert';

  const previewColumns = useMemo(
    () =>
      effectiveMapping.map((m) => {
        const fieldMeta = state.meta?.fields.find((f) => f.name === m.field);
        return {
          mapping: m,
          title: `${m.source === 'custom' ? t('(自定义)') + ' ' + (m.value || '') : m.columnName} → ${
            fieldMeta?.title || m.field
          }(${m.field})`,
        };
      }),
    [effectiveMapping, state.meta],
  );

  const attachSummary = useMemo(() => {
    if (!state.attachment) return t('未上传');
    const infos = effectiveMapping
      .filter((m) => state.meta?.fields.find((f) => f.name === m.field)?.attachment)
      .map((m) => {
        const f = state.meta?.fields.find((x) => x.name === m.field);
        return `${f?.title || m.field}→${m.config?.folder || t('未选')}`;
      });
    return t('已上传压缩包') + (infos.length ? `（${infos.join('，')}）` : '');
  }, [state.attachment, state.mapping, state.meta, effectiveMapping, t]);

  const cards: Array<[string, React.ReactNode]> = [
    [
      t('预计导入行数'),
      <strong key="rows" style={{ fontSize: 18, color: '#1677ff' }}>
        {state.preview?.totalRows ?? '-'}
      </strong>,
    ],
    [t('导入文件'), state.upload?.fileName || '-'],
    [t('导入数据表'), `${state.collection?.title}(${state.collection?.name})`],
    [t('导入的Sheet'), state.sheetName],
    [t('表头行'), `第${state.headerRow}行`],
    [t('导入模式'), modeLabel(t, state.mode)],
    [t('唯一值'), state.uniqueFields.length ? state.uniqueFields.map((f) => fieldLabel(f, state.meta?.fields || [])).join(', ') : t('无')],
    [t('附件'), attachSummary],
    [t('空白值处理'), state.blankStrategy === 'clear' ? t('按Excel更新（清空）') : t('不更新（保留原值）')],
    [t('事务模式'), t('严格模式（失败全部回滚）')],
    [t('空值唯一值预检'), isUpMode ? t('开启（空值预检 → 整批回滚）') : t('仅新增模式（不检查）')],
  ];

  const submit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await api.submitImport({
        filePath: state.upload!.filePath,
        fileName: state.upload!.fileName,
        fileKind: state.upload!.fileKind,
        sheetName: state.sheetName,
        headerRow: state.headerRow,
        collectionName: state.collection!.name,
        mode: state.mode,
        uniqueFields: state.uniqueFields,
        blankStrategy: state.blankStrategy,
        mapping: state.mapping,
        attachmentArchivePath: state.attachmentEnabled ? state.attachment?.filePath : undefined,
        permissionConfigId: state.permission?.id ?? null,
      });
      message.success(t('导入任务已提交！请到「任务管理」Tab 查看'));
      onDone();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h4 style={{ marginBottom: 16 }}>{t('预览确认')}</h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {cards.map(([label, value]) => (
          <Card key={label} size="small">
            <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
          </Card>
        ))}
      </div>

      <h5 style={{ marginBottom: 8 }}>👁️ {t('预览数据（前10行）')}</h5>
      <Table
        rowKey={(_r, i) => String(i)}
        size="small"
        pagination={false}
        scroll={{ x: true }}
        dataSource={(state.preview?.previewRows || []).map((row) =>
          Object.fromEntries(
            previewColumns.map((c, i) => [
              `c${i}`,
              c.mapping.source === 'custom' ? c.mapping.value || '' : row[c.mapping.columnIndex ?? -1],
            ]),
          ),
        )}
        columns={previewColumns.map((c, i) => ({
          title: (
            <span>
              <span style={{ color: '#1677ff', display: 'block' }}>
                {t('导入')}:{' '}
                {c.mapping.source === 'custom' ? `${c.mapping.value}${t('(自定义)')}` : c.mapping.columnName}
              </span>
              <span style={{ color: '#999', fontSize: 10, display: 'block' }}>▼</span>
              <span style={{ display: 'block' }}>{c.title.split(' → ')[1]}</span>
            </span>
          ),
          dataIndex: `c${i}`,
          render: (v: unknown) => String(v ?? ''),
        }))}
      />

      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onPrev}>← {t('上一步')}</Button>{' '}
        <Button type="primary" loading={submitting} disabled={submitting} onClick={() => setConfirmOpen(true)}>
          ▶ {t('执行导入')}
        </Button>
      </div>

      <Modal
        title={`⚠️ ${t('确认导入')}`}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={submit}
        okText={t('确认')}
        cancelText={t('取消')}
        confirmLoading={submitting}
      >
        <p style={{ lineHeight: 1.9 }}>
          {t('此操作将导入')} <strong>{state.preview?.totalRows ?? '-'}</strong> {t('行数据。')}
          <br />
          {t('导入文件')}：<strong>{state.upload?.fileName}</strong>
          <br />
          {t('导入数据表')}：
          <strong>
            {state.collection?.title}({state.collection?.name})
          </strong>
          <br />
          {t('导入模式')}：<strong>{modeLabel(t, state.mode)}</strong>
          <br />
          {isUpMode && (
            <>
              <span style={{ color: '#ff4d4f' }}>⚠ {t('空值唯一值预检已开启，任何行唯一值字段为空将整批回滚')}</span>
              <br />
            </>
          )}
          {t('事务模式')}：<strong>{t('严格模式（失败全部回滚）')}</strong>
        </p>
      </Modal>
    </div>
  );
}
