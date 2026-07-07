import React from 'react';
import { Card, Descriptions, Tag, Button, Space, App } from 'antd';
import { useApp } from '@nocobase/client-v2';
import { observer } from '@nocobase/flow-engine';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../../locale';
import { StatusBadge, TableTag, DataDot, formatTime, formatFileSize, formatDuration } from '../shared';
import { CardWrap } from './index';

export function TaskSummaryCard({ task, api, tableTitles, fieldTitles }: any) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const { message, modal } = App.useApp();
  const isImport = task.taskType === 'import';
  const fileExt = task._fileExt || '';
  const isPkg =
    fileExt === 'gz' || (task.taskType === 'export' && (task.includeAttachments || task.tableName === '__all__'));
  const fileId = isImport ? task.importFileId : task.exportFileId;
  const hasFile = fileId && (task.status === 'completed' || task.status === 'failed');

  const getAttachmentUrl = async (): Promise<{ url: string; filename: string }> => {
    if (!fileId) return { url: '', filename: '' };
    try {
      const att = await api.request({ url: 'attachments:get', method: 'get', params: { filterByTk: fileId } });
      const a = att?.data?.data || {};
      const url = a.url || a.preview || (a.path ? `storage/uploads/${a.path}` : '');
      const filename = a.filename || a.title || task.fileName || 'download';
      return { url, filename };
    } catch {
      return { url: '', filename: '' };
    }
  };

  const previewFile = async () => {
    const { url } = await getAttachmentUrl();
    if (!url) {
      message.warning(t('Unable to get file preview URL'));
      return;
    }
    const fileUrl = url.startsWith('http') ? url : `${window.location.origin}/${url.replace(/^\//, '')}`;
    if (!/^https?:\/\//.test(fileUrl)) {
      message.warning(t('Invalid file URL'));
      return;
    }
    const ext = (task._fileExt || '').toLowerCase().replace('.', '');
    const officeExts = ['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'odt'];
    if (officeExts.includes(ext)) {
      window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`, '_blank');
    } else {
      window.open(fileUrl, '_blank');
    }
  };
  const downloadFile = async () => {
    if (!fileId) return;
    let blobUrl: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const { url, filename } = await getAttachmentUrl();
      if (!url) {
        message.error(t('Unable to get file URL'));
        return;
      }
      const fetchUrl = url.startsWith('http') ? url : `/${url.replace(/^\//, '')}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`下载失败，状态码 ${response.status}`);
      const blob = await response.blob();
      blobUrl = window.URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
    } catch {
      message.error(t('Download failed'));
    } finally {
      if (link) document.body.removeChild(link);
      if (blobUrl) window.URL.revokeObjectURL(blobUrl);
    }
  };

  const showFileInfo = task.status === 'completed' || task.status === 'failed';
  const fileLabel = isImport ? t('Uploaded at') : t('Completed at');
  const failedCount = Array.isArray(task.errorLogs)
    ? task.errorLogs.length
    : Math.max(0, (task.totalRows || 0) - (task.processedRows || 0));
  const successCount = task.processedRows || 0;
  const totalCount = task.totalRows || 0;
  const fileSize = task._fileSize || task.fileSize || 0;

  return (
    <CardWrap title={`${isImport ? `📥 ${t('Import task')}` : `📤 ${t('Export task')}`} · ${t('Task summary')}`}>
      <Descriptions column={2} size="small">
        <Descriptions.Item label={t('Task ID')}>#{task.id}</Descriptions.Item>
        <Descriptions.Item label={t('Target table')}>
          <TableTag name={task.tableName} title={tableTitles[task.tableName]} />
        </Descriptions.Item>
        <Descriptions.Item label={t('Status')}>
          <StatusBadge status={task.status} />
          {task.status === 'processing' && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
              {task.progress || 0}% ·{' '}
              {t('{processed} rows {action} / total {total}', {
                processed: task.processedRows || 0,
                action: isImport ? t('imported') : t('exported'),
                total: task.totalRows || 0,
              })}
            </span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('Creator')}>{task.createdBy?.nickname || '—'}</Descriptions.Item>
        <Descriptions.Item label={t('Data count')}>
          <DataDot type="success" count={successCount} />
          <DataDot type="failed" count={failedCount} />
          <DataDot type="total" count={totalCount} />
        </Descriptions.Item>
      </Descriptions>
      <Descriptions column={2} size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label={t('Created at')}>{formatTime(task.createdAt)}</Descriptions.Item>
        <Descriptions.Item label={isImport ? t('Completed at') : t('Completed at')}>
          {formatTime(task.completedAt)}
        </Descriptions.Item>
        <Descriptions.Item label={t('Duration')}>
          {formatDuration(task.createdAt, task.completedAt, t)}
        </Descriptions.Item>
        <Descriptions.Item label={t('File size')}>{formatFileSize(fileSize)}</Descriptions.Item>
      </Descriptions>

      {showFileInfo && (
        <div
          style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginTop: 12, border: '1px solid #e5e7eb' }}
        >
          <div
            style={{
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>
              📄 {task.fileName || task._fileName || `${isImport ? t('Import source file') : t('Export file')}`}
            </span>
            {isPkg && (
              <Tag color="#7c3aed" style={{ fontSize: 11 }}>
                {t('ZIP package containing Excel and attachments')}
              </Tag>
            )}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
            {fileLabel}: {formatTime(isImport ? task.createdAt : task.completedAt)}
            {fileSize > 0 ? ` / ${formatFileSize(fileSize)}` : ''}
            {fileExt ? ` / .${fileExt}` : ''}
          </div>
          <Space>
            {!isPkg && hasFile && (
              <Button size="small" onClick={previewFile}>
                👁 {t('Preview')} {isImport ? t('Import source file') : t('Export file')}
              </Button>
            )}
            {hasFile && (
              <Button size="small" type="primary" ghost onClick={downloadFile}>
                ⬇ {t('Download')} {isImport ? t('Import source file') : t('Export file')}
              </Button>
            )}
          </Space>
        </div>
      )}

      {!isImport && (
        <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 10, marginTop: 8, border: '1px solid #bae0ff' }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label={t('Header format')}>
              <Tag color="blue">
                {task.headerStyle === 'id'
                  ? t('Field ID')
                  : task.headerStyle === 'title'
                    ? t('Field name')
                    : t('Field name (field ID)')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('Include attachments')}>
              <Tag color={task.includeAttachments ? '#059669' : '#9ca3af'}>
                {task.includeAttachments ? `✅ ${t('Yes')}` : `— ${t('No')}`}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('Association data sheet')}>
              <Tag color={task.includeAssociationSheet ? '#059669' : '#9ca3af'}>
                {task.includeAssociationSheet ? `✅ ${t('Yes')}` : `— ${t('No')}`}
              </Tag>
            </Descriptions.Item>
            {task.includeAssociationSheet && task.associationSheetTables?.length > 0 && (
              <Descriptions.Item label={t('Included association tables')}>
                <span style={{ color: '#059669' }}>{task.associationSheetTables.join('、')}</span>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      )}

      {task.status === 'cancelled' && (
        <div
          style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: 12, marginTop: 12 }}
        >
          <span style={{ color: '#9a3412' }}>{t('File not generated — task cancelled, no file generated')}</span>
        </div>
      )}

      {task.status === 'processing' &&
        task.totalRows > 0 &&
        (() => {
          const elapsed = Date.now() - new Date(task.createdAt).getTime();
          const rate = (task.processedRows || 1) / Math.max(1, elapsed);
          const remaining = Math.max(1, Math.floor((task.totalRows - (task.processedRows || 0)) / rate / 1000));
          return (
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 8 }}>
              {t('Estimated remaining time: about')}{' '}
              {remaining > 60
                ? t('Duration minutes seconds', { min: Math.floor(remaining / 60), sec: remaining % 60 })
                : t('Duration seconds', { count: remaining })}
            </div>
          );
        })()}

      {task.status === 'failed' && task.errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 12, marginTop: 8 }}>
          <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>⚠ {t('Error report')}</div>
          <div style={{ color: '#b91c1c', fontSize: 13 }}>{task.errorMessage}</div>
          {isImport && (
            <div style={{ color: '#991b1b', fontSize: 12, marginTop: 4 }}>{t('Rolled back, no data written')}</div>
          )}
          {!isImport && (
            <div style={{ color: '#991b1b', fontSize: 12, marginTop: 4 }}>{t('Rolled back, no file generated')}</div>
          )}
        </div>
      )}

      {task.status === 'processing' && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button
            size="small"
            danger
            onClick={() => {
              modal.confirm({
                title: t('Confirm cancel'),
                content: t('Are you sure to cancel this task', { id: task.id }),
                okText: t('Confirm cancel'),
                okButtonProps: { danger: true },
                onOk: async () => {
                  try {
                    await api.request({ url: 'sjgl02Tasks:cancel', method: 'post', data: { taskId: task.id } });
                    message.success(t('Cancelled'));
                  } catch {
                    message.error(t('Cancel failed'));
                  }
                },
              });
            }}
          >
            ⏹ {t('Cancel task')}
          </Button>
        </div>
      )}
    </CardWrap>
  );
}
