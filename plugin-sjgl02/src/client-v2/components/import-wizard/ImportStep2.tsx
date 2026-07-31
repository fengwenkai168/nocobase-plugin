import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Upload,
} from 'antd';
import {
  BarChartOutlined,
  EyeOutlined,
  FolderOutlined,
  KeyOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useT } from '../../locale';
import { modeLabel } from './modeLabels';
import { ImportMappingItem, UploadResult, useApi } from '../../services/api';
import { ImportWizardState } from './ImportWizard';
import MappingTable, { buildInitMapping, useImportableFields } from './MappingTable';
import ImportAttachmentCard from './ImportAttachmentCard';
import ImportPermissionSummary from './ImportPermissionSummary';
import ImportSystemFieldsCard from './ImportSystemFieldsCard';
import { fieldLabel } from './field-utils';

export default function ImportStep2({
  state,
  patch,
  markDirty,
  reloadPreview,
  onPrev,
  onNext,
}: {
  state: ImportWizardState;
  patch: (p: Partial<ImportWizardState>) => void;
  markDirty: () => void;
  reloadPreview: (upload: UploadResult, sheetName: string, headerRow: number) => Promise<unknown>;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [previewModal, setPreviewModal] = useState(false);
  const fields = useImportableFields(state.meta, state.permission);
  const headers = state.preview?.headers || [];
  const uniqueLocked = !!state.permission?.uniqueFields?.length;
  const isUpMode = state.mode === 'update' || state.mode === 'upsert';
  const attachmentFolders = state.attachment?.folders || [];
  const attachmentUploaded = !!(state.attachmentEnabled && state.attachment);

  useEffect(() => {
    if (!state.mapping.length && fields.length) {
      patch({ mapping: buildInitMapping(fields) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length]);

  useEffect(() => {
    if (!fields.length) return;
    const valid = new Set(fields.map((f) => f.name));
    const kept = state.mapping.filter((m) => valid.has(m.field));
    const existing = new Set(kept.map((m) => m.field));
    const added = fields
      .filter((f) => !existing.has(f.name))
      .map((f) => ({ field: f.name, source: 'ignore' as const }));
    if (kept.length !== state.mapping.length || added.length) {
      patch({ mapping: [...kept, ...added] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const patchDirty = (p: Partial<ImportWizardState>) => {
    patch(p);
    markDirty();
  };

  const validateBeforeNext = (): boolean => {
    const attachItems = state.mapping.filter(
      (m) => m.source !== 'ignore' && fields.find((f) => f.name === m.field)?.attachment,
    );
    if (attachItems.length) {
      if (!attachmentUploaded) {
        message.error(t('请先上传压缩包'));
        return false;
      }
      const missing = attachItems.filter((m) => !m.config?.folder);
      if (missing.length) {
        message.error(
          `${t('请先在「配置」列为附件字段选择文件夹')}：${missing.map((m) => fieldLabel(m.field, fields)).join('、')}`,
        );
        return false;
      }
    }
    // 唯一值字段不能为忽略（update/upsert 模式）
    if (isUpMode) {
      const ignoredUnique = state.uniqueFields.filter(
        (f) => state.mapping.find((m) => m.field === f)?.source === 'ignore',
      );
      if (ignoredUnique.length) {
        message.error(`${t('唯一值字段不能设为忽略')}: ${ignoredUnique.map((f) => fieldLabel(f, fields)).join(', ')}`);
        return false;
      }
    }
    // 必填字段不能为忽略
    const requiredFields = state.permission?.requiredFields || [];
    if (requiredFields.length) {
      const ignoredRequired = requiredFields.filter(
        (f) => state.mapping.find((m) => m.field === f)?.source === 'ignore',
      );
      if (ignoredRequired.length) {
        message.error(`${t('必填字段不能设为忽略')}: ${ignoredRequired.map((f) => fieldLabel(f, fields)).join(', ')}`);
        return false;
      }
    }
    return true;
  };

  const uniqueCandidates = useMemo(() => fields.filter((f) => !f.attachment && !f.multiple), [fields]);

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          <>
            <BarChartOutlined /> {t('目标数据表')}：
            <strong>
              {state.collection?.title}({state.collection?.name})
            </strong>
            {'　'}
            <FolderOutlined /> {t('上传文件')}：<strong>{state.upload?.fileName}</strong>
          </>
        }
      />

      <Card
        size="small"
        title={
          <span>
            <SettingOutlined /> Sheet & {t('表头设置')}
          </span>
        }
        style={{ marginBottom: 12 }}
      >
        <Space wrap>
          <span style={{ color: '#999' }}>{t('Sheet名称：')}</span>
          <Select
            size="small"
            style={{ minWidth: 140 }}
            value={state.sheetName}
            onChange={(v) => patchDirty({ sheetName: v })}
            options={(state.upload?.sheets || []).map((s) => ({ value: s.name, label: s.name }))}
          />
          <span style={{ color: '#999' }}>{t('表头行')}：</span>
          <Select
            size="small"
            style={{ width: 70 }}
            value={state.headerRow}
            onChange={(v) => patchDirty({ headerRow: v })}
            options={[1, 2, 3].map((v) => ({ value: v, label: String(v) }))}
          />
          <Button
            size="small"
            loading={state.previewLoading}
            disabled={state.previewLoading}
            onClick={() => state.upload && reloadPreview(state.upload, state.sheetName, state.headerRow)}
          >
            <ReloadOutlined /> {t('刷新')}
          </Button>
          <Button size="small" onClick={() => setPreviewModal(true)} disabled={!state.preview && !state.previewLoading}>
            <EyeOutlined /> {t('预览前10行')}
          </Button>
        </Space>
      </Card>
      {state.previewLoading && (
        <div style={{ padding: '8px 12px', color: '#1677ff', fontSize: 12 }}>
          <Spin size="small" /> {t('正在加载预览数据...')}
        </div>
      )}
      {state.previewError && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 8 }}
          message={t('预览加载失败')}
          description={state.previewError}
          action={
            <Button
              size="small"
              onClick={() => state.upload && reloadPreview(state.upload, state.sheetName, state.headerRow)}
            >
              {t('重试')}
            </Button>
          }
        />
      )}

      <Card
        size="small"
        title={
          <span style={{ color: '#333' }}>
            <KeyOutlined /> {t('权限切换 - 选择本次导入使用的权限配置')}
          </span>
        }
        style={{ marginBottom: 12 }}
      >
        <Alert
          style={{ marginBottom: 8 }}
          type="info"
          showIcon
          message={
            <span style={{ fontSize: 12 }}>
              {t('此表您拥有的权限配置（本表有配置的才显示）')}
              {' | '}
              {t(
                '选中权限配置后，"导入模式"锁定为该配置允许的模式。唯一值：权限已配置 → 预填锁定；未配置 → 自由选择。字段映射只显示"可导入"范围内的字段。',
              )}
            </span>
          }
        />
        <Select
          style={{ width: '100%' }}
          value={state.permission?.id ?? '__admin__'}
          onChange={(v) => {
            const permission = state.permissions.find((p) => (p.id ?? '__admin__') === v);
            if (!permission) return;
            const mode = permission.importModes[permission.importModes.length - 1] || 'insert';
            patchDirty({
              permission,
              mode,
              uniqueFields: permission.uniqueFields.length ? [...permission.uniqueFields] : [],
            });
          }}
          options={state.permissions.map((p) => ({
            value: p.id ?? '__admin__',
            label: `${p.targetType === 'user' ? '👤' : '🔐'} ${p.targetName}（${t('模式')}: ${p.importModes
              .map((m) => modeLabel(t, m))
              .join('/')}）`,
          }))}
        />
        {state.permission && <ImportPermissionSummary permission={state.permission} fields={fields} />}
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              {t('导入模式')}{' '}
              <span style={{ color: '#999' }}>
                （
                {state.permission && state.permission.importModes.length <= 1
                  ? t('权限限定唯一模式，只读不可切换')
                  : t('权限允许的模式，可下拉切换')}
                ）
              </span>
            </div>
            <Select
              style={{ width: '100%', maxWidth: 280 }}
              disabled={(state.permission?.importModes.length || 1) <= 1}
              value={state.mode}
              onChange={(v) => patchDirty({ mode: v })}
              options={(state.permission?.importModes || ['insert']).map((m) => ({ value: m, label: modeLabel(t, m) }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>{t('空白字段处理模式')}</div>
            <Radio.Group
              value={state.blankStrategy}
              onChange={(e) => patchDirty({ blankStrategy: e.target.value })}
              options={[
                { value: 'clear', label: t('按Excel更新（清空）') },
                { value: 'preserve', label: t('不更新（保留原值）') },
              ]}
            />
          </div>
        </div>
      </Card>

      {isUpMode && (
        <Card
          size="small"
          style={{ marginBottom: 12 }}
          title={
            <span style={{ color: '#333' }}>
              <KeyOutlined /> {t('唯一值字段（用于匹配已有记录，最多3个）')}
              <span style={{ color: '#ff4d4f', fontSize: 11, marginLeft: 4 }}>
                * {t('更新/upsert 模式必须至少选1个')}
              </span>
              {uniqueLocked && <Tag style={{ marginLeft: 8 }}>🔒 {t('由权限锁定')}</Tag>}
            </span>
          }
        >
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            {uniqueLocked
              ? t('唯一值字段由权限配置锁定，不可修改。')
              : t('选择用于判断记录是否已存在的组合字段。所有字段值都匹配才视为同一条记录。')}
            {'　'}
            <span style={{ color: '#999' }}>
              {t('空值唯一值预检')}：{modeLabel(t, state.mode)} {t('模式下，任何行的唯一值字段为空 → ')}
              <span style={{ color: '#ff4d4f' }}>{t('整批回滚')}</span>
            </span>
          </div>
          <Space wrap>
            {state.uniqueFields.map((f) => (
              <Tag
                key={f}
                color="orange"
                closable={!uniqueLocked}
                onClose={() => patchDirty({ uniqueFields: state.uniqueFields.filter((x) => x !== f) })}
              >
                {fieldLabel(f, fields)}
              </Tag>
            ))}
            {!uniqueLocked && state.uniqueFields.length < 3 && (
              <Select
                size="small"
                style={{ minWidth: 180 }}
                placeholder={t('+ 添加字段')}
                value={null}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                onChange={(v) => patchDirty({ uniqueFields: [...state.uniqueFields, v] })}
                options={uniqueCandidates
                  .filter((f) => !state.uniqueFields.includes(f.name))
                  .map((f) => ({ value: f.name, label: `${f.title}(${f.name})` }))}
              />
            )}
          </Space>
        </Card>
      )}

      <Collapse
        ghost
        defaultActiveKey={['mapping']}
        style={{ marginBottom: 12, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}
        items={[
          {
            key: 'mapping',
            label: (
              <span style={{ fontWeight: 600 }}>
                <SettingOutlined /> {t('字段映射')}{' '}
                <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>
                  （
                  {t('共{{total}}列/已用{{used}}/剩余{{left}}', {
                    total: headers.length,
                    used: state.mapping.filter((m) => m.source === 'excel').length,
                    left: headers.length - state.mapping.filter((m) => m.source === 'excel').length,
                  })}
                  ）
                </span>
              </span>
            ),
            children: (
              <MappingTable
                meta={state.meta}
                fields={fields}
                headers={headers}
                mapping={state.mapping}
                requiredFields={state.permission?.requiredFields || []}
                uniqueFields={state.uniqueFields}
                mode={state.mode}
                attachmentUploaded={attachmentUploaded}
                attachmentFolders={attachmentFolders}
                onChange={(mapping: ImportMappingItem[]) => patchDirty({ mapping })}
              />
            ),
          },
        ]}
      />

      <ImportAttachmentCard state={state} patch={patchDirty} markDirty={markDirty} />
      <ImportSystemFieldsCard />

      <div style={{ textAlign: 'right' }}>
        <Button onClick={onPrev}>← {t('上一步')}</Button>{' '}
        <Button
          type="primary"
          disabled={
            (isUpMode && state.uniqueFields.length === 0) ||
            (isUpMode &&
              state.uniqueFields.every((f) => state.mapping.find((m) => m.field === f)?.source === 'ignore')) ||
            (state.permission?.requiredFields || []).some(
              (f) => state.mapping.find((m) => m.field === f)?.source === 'ignore',
            )
          }
          onClick={() => {
            if (validateBeforeNext()) onNext();
          }}
        >
          {t('下一步')} →
        </Button>
      </div>

      <Modal
        title={
          <span>
            <EyeOutlined /> {t('Excel预览（前10行）')} - {state.sheetName}
          </span>
        }
        open={previewModal}
        width={900}
        footer={<Button onClick={() => setPreviewModal(false)}>{t('关闭')}</Button>}
        onCancel={() => setPreviewModal(false)}
      >
        <Table
          rowKey={(_r, i) => String(i)}
          size="small"
          pagination={false}
          scroll={{ x: true }}
          dataSource={(state.preview?.previewRows || []).map((row) =>
            Object.fromEntries(row.map((v, i) => [`c${i}`, v])),
          )}
          columns={headers.map((h, i) => ({ title: h, dataIndex: `c${i}`, render: (v: unknown) => String(v ?? '') }))}
        />
      </Modal>
    </div>
  );
}
