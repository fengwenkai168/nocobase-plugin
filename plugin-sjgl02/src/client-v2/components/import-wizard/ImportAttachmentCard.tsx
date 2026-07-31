import React, { useState } from 'react';
import { Alert, App, Button, Card, Space, Switch, Upload } from 'antd';
import { CheckCircleFilled, DownloadOutlined, FolderOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { UploadResult, useApi } from '../../services/api';
import { ImportWizardState } from './ImportWizard';

export default function ImportAttachmentCard({
  state,
  patch,
  markDirty,
}: {
  state: ImportWizardState;
  patch: (p: Partial<ImportWizardState>) => void;
  markDirty: () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [attUploading, setAttUploading] = useState(false);
  const attachmentFolders = state.attachment?.folders || [];

  const patchDirty = (p: Partial<ImportWizardState>) => {
    patch(p);
    markDirty();
  };

  return (
    <Card
      size="small"
      title={
        <span>
          <PaperClipOutlined /> {t('附件导入')}
        </span>
      }
      style={{ marginBottom: 12 }}
    >
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
                const attachment: UploadResult = await api.uploadFile(file as File, 'attachment');
                patchDirty({ attachment });
                onSuccess?.(attachment);
              } catch (error) {
                message.error(String(error));
                onError?.(error as Error);
              } finally {
                setAttUploading(false);
              }
            }}
          >
            {state.attachment ? (
              <div style={{ color: '#52c41a' }}>
                <CheckCircleFilled /> {state.attachment.fileName}
                {attachmentFolders.length > 0 && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    {t('包含文件夹')}：{attachmentFolders.map((f) => `${f.name}（${f.fileCount}）`).join('、')}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#999' }}>
                <FolderOutlined /> {attUploading ? t('上传中...') : t('点击上传 attachments.tar.gz')}
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
                {t('上传后，需在下方字段映射表的「配置」列为每个附件字段手动选择对应文件夹（必选，不选无法提交导入）')}
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
              <DownloadOutlined /> {t('下载附件压缩包模板')}
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
  );
}
