import React from 'react';
import { Card, Button, Space, Select, InputNumber, Tag, Alert, Modal, Descriptions, Table, Upload } from 'antd';
import { InboxOutlined, TableOutlined } from '@ant-design/icons';
import { ImportTableItem, PermSourceOption } from '../import-hooks/importTypes';
import ImportMappingTable from './ImportMappingTable';

const { Dragger } = Upload;

interface ImportStepUploadProps {
  client: any;
  message: any;
  selectedTable: ImportTableItem | null;
  isAdminOrRoot: boolean;
  permSource: { type: string; id?: string; label?: string } | null;
  permSourceOptions: PermSourceOption[];
  allowedModes: string[];
  importMode: string;
  uploadedFileId: number | null;
  uploadedFileName: string;
  previewMeta: any;
  sheetName: string;
  headerRow: number;
  availSheets: string[];
  excelHeaders: string[];
  tableFields: any[];
  uniqueFields: string[];
  permUniqueFields: string[];
  permRequiredFields: string[];
  permImportFields: string[];
  fieldMapping: Record<string, string>;
  customValues: Record<string, string>;
  blankCellMode: string;
  matchInfo: string;
  previewModal: boolean;
  onImportModeChange: (mode: string) => void;
  onPermSourceChange: (val: string) => void;
  onFileSelect: (info: any) => void;
  onSheetNameChange: (val: string) => void;
  onHeaderRowChange: (val: number) => void;
  onUniqueFieldsChange: (vals: string[]) => void;
  onBlankCellModeChange: (val: string) => void;
  onFieldMappingChange: (mapping: Record<string, string>) => void;
  onCustomValuesChange: (values: Record<string, string>) => void;
  onAutoMatch: () => void;
  onClearMapping: () => void;
  onPreviewModalChange: (open: boolean) => void;
  onResetFile: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function ImportStepUpload(props: ImportStepUploadProps) {
  const {
    client,
    message,
    selectedTable,
    isAdminOrRoot,
    permSource,
    permSourceOptions,
    allowedModes,
    importMode,
    uploadedFileId,
    uploadedFileName,
    previewMeta,
    sheetName,
    headerRow,
    availSheets,
    excelHeaders,
    tableFields,
    uniqueFields,
    permUniqueFields,
    permRequiredFields,
    permImportFields,
    fieldMapping,
    customValues,
    blankCellMode,
    matchInfo,
    previewModal,
    onImportModeChange,
    onPermSourceChange,
    onFileSelect,
    onSheetNameChange,
    onHeaderRowChange,
    onUniqueFieldsChange,
    onBlankCellModeChange,
    onFieldMappingChange,
    onCustomValuesChange,
    onAutoMatch,
    onClearMapping,
    onPreviewModalChange,
    onResetFile,
    onPrev,
    onNext,
  } = props;

  const nextDisabled = React.useMemo(() => {
    if (!uploadedFileId) return true;
    if (importMode === 'insert') return false;
    if (uniqueFields.length === 0) return true;
    return uniqueFields.some((uf) => !fieldMapping[uf] || fieldMapping[uf] === '__ignore__');
  }, [uploadedFileId, importMode, uniqueFields, fieldMapping]);

  return (
    <div>
      {!uploadedFileId ? (
        <Dragger
          data-testid="import-file-upload"
          name="file"
          multiple={false}
          accept=".xlsx,.xls,.csv"
          customRequest={async ({ file, onSuccess, onError }: any) => {
            try {
              const fd = new FormData();
              fd.append('file', file);
              const r = await client.request({ url: 'attachments:create', method: 'post', data: fd });
              const d = r?.data?.data ?? r?.data;
              onSuccess({ id: d?.id, ...d }, file);
            } catch (err) {
              onError(err);
            }
          }}
          onChange={onFileSelect}
          beforeUpload={(file) => {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
              message.error('不支持的文件格式');
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
          <p className="ant-upload-text">点击或拖拽上传文件</p>
          <p className="ant-upload-hint">支持 .xlsx / .xls / .csv，最大 50MB</p>
        </Dragger>
      ) : (
        <div>
          <Card size="small" style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#999' }}>📋 导入到的数据表：</span>
              <Tag color="blue">
                {selectedTable?.title || selectedTable?.name}({selectedTable?.name})
              </Tag>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#666' }}>上传的文件：</span>
              <Tag color="blue">{uploadedFileName}</Tag>
              <Button size="small" style={{ marginLeft: 4 }} onClick={onResetFile}>
                重新上传
              </Button>
              {previewMeta && (
                <span style={{ color: '#999', fontSize: 12, marginLeft: 4 }}>
                  共 {previewMeta.headerColumns?.length || 0} 列 / {previewMeta.totalRows || 0} 行数据
                </span>
              )}
              <span style={{ color: '#bbb', fontSize: 12, marginLeft: 4 }}>|</span>
              <span style={{ color: '#999', fontSize: 12 }}>Sheet：</span>
              <Select
                value={sheetName}
                onChange={onSheetNameChange}
                style={{ minWidth: 120 }}
                size="small"
                options={availSheets.map((s) => ({ value: s, label: s }))}
              />
              <span style={{ color: '#999', fontSize: 12 }}>表头行：</span>
              <InputNumber
                min={1}
                max={100}
                value={headerRow}
                onChange={(v) => onHeaderRowChange(v || 1)}
                style={{ width: 70 }}
                size="small"
              />
              <Button
                size="small"
                icon={<TableOutlined />}
                disabled={!previewMeta?.previewRows?.length}
                onClick={() => onPreviewModalChange(true)}
              >
                预览表头
              </Button>
            </div>
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 4 }}>
              <Space data-testid="import-mode-control">
                <span style={{ color: '#999', fontSize: 12 }}>导入模式：</span>
                {allowedModes.length === 1 ? (
                  <Tag color="orange">
                    {allowedModes[0] === 'insert' ? '新增' : allowedModes[0] === 'update' ? '更新' : '新增+更新'}
                  </Tag>
                ) : allowedModes.length > 1 ? (
                  <Select
                    value={importMode}
                    onChange={onImportModeChange}
                    style={{ width: 220 }}
                    size="small"
                    options={[
                      { value: 'insert', label: '新增 (insert)' },
                      { value: 'update', label: '更新 (update)' },
                      { value: 'upsert', label: '新增+更新 (upsert)' },
                    ].filter((o) => allowedModes.includes(o.value))}
                  />
                ) : (
                  <Tag color="red">无权限</Tag>
                )}
              </Space>
            </div>
            {isAdminOrRoot && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 4 }}>
                <Space>
                  <span style={{ color: '#999', fontSize: 12 }}>切换已配置的方案：</span>
                  <Select
                    value={
                      permSource?.type === 'admin'
                        ? 'admin'
                        : permSource
                          ? `${permSource.type}:${permSource.id}`
                          : 'admin'
                    }
                    onChange={onPermSourceChange}
                    style={{ minWidth: 200 }}
                    size="small"
                    options={permSourceOptions}
                  />
                </Space>
              </div>
            )}
          </Card>
          {(importMode === 'update' || importMode === 'upsert') && (
            <Card size="small" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>🔑 唯一值字段</div>
              {permUniqueFields.length > 0 ? (
                <div>
                  <Space wrap>
                    {permUniqueFields.map((f) => (
                      <Tag key={f} color="orange">
                        {(tableFields.find((tf: any) => tf.name === f)?.uiSchema?.title || f) + '(' + f + ')'}
                      </Tag>
                    ))}
                  </Space>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>⚠️ 唯一值字段由管理员配置，不可修改</div>
                </div>
              ) : (
                <Select
                  mode="multiple"
                  value={uniqueFields}
                  onChange={onUniqueFieldsChange}
                  style={{ width: '100%' }}
                  placeholder="选择唯一值字段"
                  options={tableFields.map((f: any) => ({
                    value: f.name,
                    label: (f.uiSchema?.title || f.name) + '(' + f.name + ')',
                  }))}
                />
              )}
            </Card>
          )}
          <Card size="small" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>📝 空白单元格处理</div>
            <Select
              value={blankCellMode}
              onChange={onBlankCellModeChange}
              style={{ width: '100%' }}
              options={[
                { value: 'update', label: '按Excel值更新（空单元格不处理，保持原Excel值）' },
                { value: 'null', label: '按NULL更新（空单元格写入数据库 NULL）' },
                { value: 'skip', label: '跳过（空单元格不动，保留数据库原有数据）' },
              ]}
            />
          </Card>
          {excelHeaders.length > 0 && (
            <Card
              size="small"
              title={
                <span>
                  📊 字段映射 ·{' '}
                  {matchInfo && (
                    <Tag color={matchInfo.includes('0未匹配') ? 'green' : 'orange'} style={{ fontSize: 11 }}>
                      ⚡{matchInfo}
                    </Tag>
                  )}
                  <Button size="small" style={{ marginLeft: 12 }} onClick={onAutoMatch}>
                    ⚡ 自动匹配
                  </Button>
                  <Button size="small" style={{ marginLeft: 6 }} onClick={onClearMapping}>
                    🗑 清空
                  </Button>
                </span>
              }
              style={{ marginBottom: 12 }}
            >
              {permRequiredFields.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8, fontSize: 12 }}
                  message={
                    <span>
                      必填字段：
                      <Space wrap>
                        {permRequiredFields.map((f) => {
                          const mapped = fieldMapping[f];
                          const ok = mapped && mapped !== '__ignore__';
                          const label =
                            (tableFields.find((tf: any) => tf.name === f)?.uiSchema?.title || f) + '(' + f + ')';
                          return (
                            <Tag key={f} color={ok ? 'green' : 'red'}>
                              {label}
                              {ok ? ' ✓已映射' : ' ✗未映射'}
                            </Tag>
                          );
                        })}
                      </Space>
                    </span>
                  }
                />
              )}
              {permImportFields.length > 0 && (
                <div style={{ fontSize: 11, color: '#1677ff', marginBottom: 8 }}>
                  📋 管理员限制可导入字段：
                  {permImportFields
                    .map((f) => {
                      const tf = tableFields.find((t: any) => t.name === f);
                      return (tf?.uiSchema?.title || f) + '(' + f + ')';
                    })
                    .join(', ')}
                </div>
              )}
              <ImportMappingTable
                tableFields={tableFields}
                excelHeaders={excelHeaders}
                permImportFields={permImportFields}
                permRequiredFields={permRequiredFields}
                permUniqueFields={permUniqueFields}
                uniqueFields={uniqueFields}
                fieldMapping={fieldMapping}
                customValues={customValues}
                onFieldMappingChange={onFieldMappingChange}
                onCustomValuesChange={onCustomValuesChange}
              />
            </Card>
          )}
          <Modal
            title="📋 表头及预览数据"
            open={previewModal}
            onCancel={() => onPreviewModalChange(false)}
            footer={<Button onClick={() => onPreviewModalChange(false)}>关闭</Button>}
            width={800}
          >
            {previewMeta && (
              <div>
                <Descriptions size="small" column={3} bordered style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Sheet">{sheetName}</Descriptions.Item>
                  <Descriptions.Item label="表头行">{headerRow}</Descriptions.Item>
                  <Descriptions.Item label="数据行数">{previewMeta.totalRows || 0}</Descriptions.Item>
                </Descriptions>
                <Table
                  dataSource={
                    previewMeta.previewRows?.map((row: any, idx: number) => ({ ...row, __rowKey: idx })) || []
                  }
                  rowKey="__rowKey"
                  columns={
                    previewMeta.headerColumns?.map((h: string) => ({
                      title: h,
                      dataIndex: h,
                      ellipsis: true,
                    })) || []
                  }
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content' }}
                />
              </div>
            )}
            {!previewMeta && <span>请先上传并解析文件</span>}
          </Modal>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button onClick={onPrev} style={{ marginRight: 8 }}>
              ← 上一步
            </Button>
            <Button type="primary" disabled={nextDisabled} onClick={onNext}>
              下一步 →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
