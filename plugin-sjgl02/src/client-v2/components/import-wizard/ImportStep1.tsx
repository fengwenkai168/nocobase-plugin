import React, { useEffect, useState } from 'react';
import { App, Button, Card, Col, Row, Select, Upload } from 'antd';
import {
  BarChartOutlined,
  BulbOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  FolderOutlined,
  InboxOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useT } from '../../locale';
import { CollectionOption, useApi } from '../../services/api';
import { ImportWizardState } from './ImportWizard';

export default function ImportStep1({
  state,
  patch,
  onNext,
}: {
  state: ImportWizardState;
  patch: (p: Partial<ImportWizardState>) => void;
  onNext: () => void;
}) {
  const t = useT();
  const api = useApi();
  const { message } = App.useApp();
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api
      .getImportableCollections()
      .then((res) => setCollections(res.collections))
      .catch(() => {});
  }, [api]);

  const ready = !!state.collection && !!state.upload;

  // ReactNode label 下 optionFilterProp="label" 无法匹配，改用纯文本 title/name 过滤
  const filterCollection = (input: string, option?: { title?: string; name?: string }) => {
    const text = `${option?.title ?? ''}${option?.name ?? ''}`.toLowerCase();
    return text.includes(input.toLowerCase());
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card
            size="small"
            title={
              <span>
                <FileTextOutlined /> {t('选择目标数据表')}
              </span>
            }
          >
            <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>{t('数据表')}</div>
            <Select
              style={{ width: '100%' }}
              placeholder={t('- 请选择数据表 -')}
              value={state.collection?.name}
              showSearch
              filterOption={filterCollection}
              onChange={(name) => {
                const collection = collections.find((c) => c.name === name);
                patch({ collection });
              }}
              options={collections.map((c) => ({
                value: c.name,
                title: c.title,
                name: c.name,
                label: (
                  <span>
                    <FolderOutlined /> {c.title}({c.name})
                  </span>
                ),
              }))}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              <BulbOutlined /> {t('仅显示您有权限导入的数据表')}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              <BarChartOutlined /> {t('共 {{count}} 张数据表可供选择', { count: collections.length })}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title={
              <span>
                <UploadOutlined /> {t('上传文件')}
              </span>
            }
          >
            <Upload.Dragger
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                setUploading(true);
                try {
                  const upload = await api.uploadFile(file as File, 'excel');
                  patch({ upload });
                  onSuccess?.(upload);
                } catch (error) {
                  const text = String((error as { response?: { data?: unknown } })?.response?.data || error);
                  const match = text.match(/"message"\s*:\s*"([^"]+)"/);
                  message.error(match ? match[1] : t('上传失败，请检查文件格式'));
                  onError?.(error as Error);
                } finally {
                  setUploading(false);
                }
              }}
            >
              {state.upload ? (
                <div style={{ color: '#52c41a' }}>
                  <CheckCircleFilled /> {t('上传成功！')}
                  <br />
                  <span style={{ fontSize: 12 }}>
                    {state.upload.fileName}（{(state.upload.size / 1024).toFixed(1)} KB）
                  </span>
                </div>
              ) : (
                <>
                  <p>
                    <InboxOutlined style={{ fontSize: 40, color: '#bbb' }} />
                  </p>
                  <p>{uploading ? t('上传中...') : t('点击或拖拽上传文件')}</p>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    {t('支持 .xlsx(上限 50 万行) / .xls(≤20万) / .csv 格式')}
                  </p>
                </>
              )}
            </Upload.Dragger>
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button type="primary" disabled={!ready} onClick={onNext}>
          {t('下一步')} →
        </Button>
      </div>
    </div>
  );
}
