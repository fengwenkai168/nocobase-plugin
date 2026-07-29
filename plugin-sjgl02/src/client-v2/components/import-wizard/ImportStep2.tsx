import React, { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Collapse, Modal, Radio, Select, Space, Spin, Switch, Table, Tag, Upload } from 'antd';
import { useT } from '../../locale';
import { modeLabel } from './modeLabels';
import { ImportMappingItem, UploadResult, useApi } from '../../services/api';
import { ImportWizardState } from './ImportWizard';
import MappingTable, { buildInitMapping, useImportableFields } from './MappingTable';

export function fieldLabel(name: string, fieldList: Array<{ name: string; title: string }>): string {
  const f = fieldList.find((x) => x.name === name);
  return f ? `${f.title}(${f.name})` : name;
}

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
  const [attUploading, setAttUploading] = useState(false);
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
    if (!attachItems.length) return true;
    if (!attachmentUploaded) {
      message.error(t('请先上传压缩包'));
      return false;
    }
    const missing = attachItems.filter((m) => !m.config?.folder);
    if (missing.length) {
      message.error(`${t('请先在「配置」列为附件字段选择文件夹')}：${missing.map((m) => fieldLabel(m.field, fields)).join('、')}`);
      return false;
    }
    return true;
  };

  const uniqueCandidates = useMemo(() => fields.filter((f) => !f.attachment && !f.multiple), [fields]);

  const permissionSummary = state.permission && (
    <Collapse
      size="small"
      style={{ background: '#f9f5ff', borderColor: '#e8d5f5', marginTop: 12 }}
      items={[{
        key: '1',
        label: (
          <span style={{ fontSize: 12 }}>
            {state.permission.targetType === 'user' ? '👤' : '🔐'} {state.permission.targetName}
            {'（'}{t('模式')}: {state.permission.importModes.map((m) => modeLabel(t, m)).join('/')}{'）'}
          </span>
        ),
        children: (
          <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <div>
              <strong style={{ color: '#722ed1' }}>📋 {t('类型')}：</strong>
              <Tag color={state.permission.targetType === 'user' ? 'blue' : 'green'}>
                {state.permission.targetType === 'user' ? t('用户') : t('角色')}
              </Tag>
              <strong>{state.permission.targetName}</strong>
            </div>
            <div>
              <strong style={{ color: '#722ed1' }}>⬇ {t('导入模式')}：</strong>
              {state.permission.importModes.map((m) => (
                <Tag key={m} color="blue">{modeLabel(t, m)}</Tag>
              ))}
              {state.permission.importModes.length <= 1 && <Tag>🔒 {t('只读（权限限定唯一模式）')}</Tag>}
            </div>
            <div>
              <strong style={{ color: '#722ed1' }}>🔑 {t('唯一值')}：</strong>
              {state.permission.uniqueFields.length ? (
                <>
                  {state.permission.uniqueFields.map((f) => (
                    <Tag key={f} color="orange">{fieldLabel(f, fields)}</Tag>
                  ))}
                  <Tag>🔒 {t('由权限锁定')}</Tag>
                </>
              ) : (
                <Tag color="green">✏️ {t('自由选择')}</Tag>
              )}
            </div>
            <div>
              <strong style={{ color: '#722ed1' }}>❗ {t('必填字段')}：</strong>
              {state.permission.requiredFields.length ? (
                state.permission.requiredFields.map((f) => (
                  <Tag key={f} color="red">{fieldLabel(f, fields)}</Tag>
                ))
              ) : (
                <span style={{ color: '#999' }}>{t('无')}</span>
              )}
            </div>
            <div>
              <strong style={{ color: '#722ed1' }}>✅ {t('可导入字段')}：</strong>
              {state.permission.importFields.length ? (
                <>
                  {state.permission.importFields.map((f) => (
                    <Tag key={f} color="blue">{fieldLabel(f, fields)}</Tag>
                  ))}
                  <span style={{ color: '#999', fontSize: 11 }}>
                    （{t('共{{count}}个字段', { count: state.permission!.importFields.length })}）
                  </span>
                </>
              ) : (
                <Tag color="green">{t('全部字段允许（未限制）')}</Tag>
              )}
            </div>
          </div>
        ),
      }]}
    />
  );

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          <>
            📊 {t('目标数据表')}：
            <strong>
              {state.collection?.title}({state.collection?.name})
            </strong>
            {'　'}📁 {t('上传文件')}：<strong>{state.upload?.fileName}</strong>
          </>
        }
      />

      <Card size="small" title={`⚙️ Sheet & ${t('表头设置')}`} style={{ marginBottom: 12 }}>
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
            🔄 {t('刷新')}
          </Button>
          <Button size="small" onClick={() => setPreviewModal(true)} disabled={!state.preview && !state.previewLoading}>
            👁 {t('预览前10行')}
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
            <Button size="small" onClick={() => state.upload && reloadPreview(state.upload, state.sheetName, state.headerRow)}>
              {t('重试')}
            </Button>
          }
        />
      )}

      <Card
        size="small"
        title={<span style={{ color: '#722ed1' }}>🔑 {t('权限切换 - 选择本次导入使用的权限配置')}</span>}
        style={{ marginBottom: 12, borderLeft: '3px solid #722ed1' }}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
          {t('此表您拥有的权限配置（本表有配置的才显示）')}
        </div>
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
        {permissionSummary}
        <Alert
          style={{ marginTop: 8 }}
          type="info"
          showIcon
          message={t(
            '选中权限配置后，"导入模式"锁定为该配置允许的模式。唯一值：权限已配置 → 预填锁定；未配置 → 自由选择。字段映射只显示"可导入"范围内的字段。',
          )}
        />
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
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>📝 {t('空白字段处理模式')}</div>
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
            <span style={{ color: '#fa8c16' }}>
              🔑 {t('唯一值字段（用于匹配已有记录，最多3个）')}
              <span style={{ color: '#ff4d4f', fontSize: 11, marginLeft: 4 }}>
                * {t('更新/upsert 模式必须至少选1个')}
              </span>
              {uniqueLocked && <Tag style={{ marginLeft: 8 }}>🔒 {t('由权限锁定')}</Tag>}
            </span>
          }
        >
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            {uniqueLocked
              ? t('唯一值字段由权限配置锁定，不可修改。')
              : t('选择用于判断记录是否已存在的组合字段。所有字段值都匹配才视为同一条记录。')}
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
                style={{ minWidth: 140 }}
                placeholder={t('+ 添加字段')}
                value={null}
                onChange={(v) => patchDirty({ uniqueFields: [...state.uniqueFields, v] })}
                options={uniqueCandidates
                  .filter((f) => !state.uniqueFields.includes(f.name))
                  .map((f) => ({ value: f.name, label: `${f.title}(${f.name})` }))}
              />
            )}
          </Space>
          <Alert
            style={{ marginTop: 8, marginBottom: 0 }}
            type="warning"
            showIcon
            message={
              <>
                <strong>{t('空值唯一值预检')}</strong>：{modeLabel(t, state.mode)}{' '}
                {t('模式下，任何行的唯一值字段为空 → ')}
                <strong style={{ color: '#ff4d4f' }}>{t('整批回滚')}</strong>
              </>
            }
          />
        </Card>
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
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
      </Card>

      <Card size="small" title={`📎 ${t('附件导入')}`} style={{ marginBottom: 12 }}>
        <Space style={{ marginBottom: 12 }}>
          <Switch
            checked={state.attachmentEnabled}
            onChange={(v) => patchDirty({ attachmentEnabled: v, attachment: v ? state.attachment : undefined })}
          />
          <span style={{ fontSize: 13, color: state.attachmentEnabled ? '#52c41a' : '#999' }}>
            {state.attachmentEnabled ? t('需要附件（上传 tar.gz）') : t('不需要附件')}
          </span>
        </Space>
        {state.attachmentEnabled ? (
          <>
            <Upload.Dragger
              accept=".gz,.tar.gz,.tgz"
              showUploadList={false}
              style={{ marginBottom: 12 }}
              customRequest={async ({ file, onSuccess, onError }) => {
                setAttUploading(true);
                try {
                  const attachment = await api.uploadFile(file as File, 'attachment');
                  patchDirty({ attachment });
                  onSuccess?.(attachment);
                } catch (error) {
                  onError?.(error as Error);
                } finally {
                  setAttUploading(false);
                }
              }}
            >
              {state.attachment ? (
                <div style={{ color: '#52c41a' }}>
                  ✅ {state.attachment.fileName}
                  {attachmentFolders.length > 0 && (
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {t('包含文件夹')}：{attachmentFolders.map((f) => `${f.name}（${f.fileCount}）`).join('、')}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#999' }}>
                  📁 {attUploading ? t('上传中...') : t('点击上传 attachments.tar.gz')}
                </div>
              )}
            </Upload.Dragger>
            <Alert
              type="warning"
              showIcon
              message={
                <div style={{ fontSize: 12 }}>
                  <strong>{t('附件压缩包说明：')}</strong>
                  <br />
                  1. {t('将附件文件按文件夹分类整理（如 photos/、docs/），压缩为 tar.gz 格式')}
                  <br />
                  2.{' '}
                  {t(
                    '上传后，需在下方字段映射表的「配置」列为每个附件字段手动选择对应文件夹（必选，不选无法提交导入）',
                  )}
                  <br />
                  3. {t('Excel 中附件列填写文件名（含扩展名），多个附件用逗号分隔')}
                  <br />
                  4. {t('系统从该字段选中的文件夹中查找同名文件，上传并关联到数据行')}
                  <br />
                  5. {t('压缩包内文件名必须与 Excel 中填写的完全一致')}
                </div>
              }
            />
            <div style={{ marginTop: 8 }}>
              <Button
                size="small"
                onClick={() => api.downloadFile('/api/sjgl02:downloadTemplate', 'attachments-template.tar.gz')}
              >
                📥 {t('下载附件压缩包模板')}
              </Button>
            </div>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            message={
              <>
                <strong>{t('本次导入不导入附件')}</strong>
                {t('。若 Excel 中存在附件列，系统会忽略该列。')}
              </>
            }
          />
        )}
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Collapse
          items={[
            {
              key: 'rules',
              label: `⚙️ ${t('NocoBase 系统字段处理逻辑')}`,
              children: (
                <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                  <div>
                    • <strong>createdAt/updatedAt/createdById/updatedById</strong>：
                    {t(
                      '未映射 → 系统自动处理；映射了 Excel 列 → 用 Excel 的值（Excel映射优先）。映射值非法（日期无法解析/用户不存在）→ 该行失败 → 整批回滚。',
                    )}
                  </div>
                  <div>
                    • <strong>{t('主键字段')}</strong>：
                    {t(
                      '动态发现。自增/自动生成型：未映射自动生成；手动型(string)：必须映射且非空。主键值与库内或本批次重复 → 整批回滚。',
                    )}
                  </div>
                  <div>
                    • <strong>{t('关联字段')}</strong>：
                    {t(
                      '按目标表主键值关联（多值逗号分隔）。空值处理（保留/解除关联）、匹配不到处理（行失败/跳过该字段）、更新模式（覆盖/追加，仅update/upsert，多对一除外）可在「配置」列按字段设置。',
                    )}
                  </div>
                  <div>
                    • <strong>{t('附件字段')}</strong>：
                    {t(
                      'Excel填文件名，系统从「配置」列选中的文件夹查找上传。空值处理（保留/删除附件）、匹配不到处理（行失败/跳过该附件）、更新模式（覆盖/追加，仅update/upsert）可按字段设置。',
                    )}
                  </div>
                  <div>
                    • <strong>{t('子表格/子表单、公式字段')}</strong>：{t('直接忽略，不报错。')}
                  </div>
                  <div>
                    • <strong>{t('事务模式')}</strong>：{t('严格模式——任何 1 行失败或任务取消，整批全部回滚。')}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <div style={{ textAlign: 'right' }}>
        <Button onClick={onPrev}>← {t('上一步')}</Button>{' '}
        <Button
          type="primary"
          disabled={isUpMode && state.uniqueFields.length === 0}
          onClick={() => {
            if (validateBeforeNext()) onNext();
          }}
        >
          {t('下一步')} →
        </Button>
      </div>

      <Modal
        title={`👁️ ${t('Excel预览（前10行）')} - ${state.sheetName}`}
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
