import React from 'react';
import { Card, Button, Space, Select, Tag, Input, Checkbox, Switch, Radio, Row, Col } from 'antd';
import { ExportTableItem, PermSourceOption, ExportFieldItem } from '../export-hooks/exportTypes';

interface ExportStepConfigProps {
  isAdminOrRoot: boolean;
  isAllTables: boolean;
  selTable: string;
  permSource: { type: string; id?: string; label?: string } | null;
  permSourceOptions: PermSourceOption[];
  onPermSourceChange: (val: string) => void;
  tables: ExportTableItem[];
  fields: ExportFieldItem[];
  selFields: string[];
  setSelFields: (v: string[]) => void;
  onToggleField: (name: string) => void;
  includeAssocSheet: boolean;
  onIncludeAssocSheetChange: (v: boolean) => void;
  selectedAssocTables: string[];
  onSelectedAssocTablesChange: (v: string[]) => void;
  fileName: string;
  onFileNameChange: (v: string) => void;
  headerStyle: string;
  onHeaderStyleChange: (v: string) => void;
  includeAttachments: boolean;
  onIncludeAttachmentsChange: (v: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function ExportStepConfig({
  isAdminOrRoot,
  isAllTables,
  selTable,
  permSource,
  permSourceOptions,
  onPermSourceChange,
  tables,
  fields,
  selFields,
  setSelFields,
  onToggleField,
  includeAssocSheet,
  onIncludeAssocSheetChange,
  selectedAssocTables,
  onSelectedAssocTablesChange,
  fileName,
  onFileNameChange,
  headerStyle,
  onHeaderStyleChange,
  includeAttachments,
  onIncludeAttachmentsChange,
  onPrev,
  onNext,
}: ExportStepConfigProps) {
  const regular = fields.filter(
    (f) => !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type || '') && !f.isForeignKey,
  );
  const assoc = fields.filter((f) => ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type || ''));
  const fkFields = fields.filter((f) => f.isForeignKey);

  return (
    <div>
      {isAdminOrRoot && !isAllTables && (
        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f0f7ff', border: '1px solid #bae0ff' }}>
          <Space>
            <span style={{ color: '#333', fontWeight: 500, fontSize: 13 }}>切换已配置的方案：</span>
            <Select
              value={
                permSource?.type === 'admin' ? 'admin' : permSource ? `${permSource.type}:${permSource.id}` : 'admin'
              }
              onChange={onPermSourceChange}
              style={{ minWidth: 240 }}
              size="small"
              options={permSourceOptions}
            />
          </Space>
        </Card>
      )}
      {isAllTables ? (
        <Card title="📦 全部数据表导出" size="small" style={{ marginBottom: 16 }}>
          <p>
            ✅ 将导出系统中所有数据表，最终打包为 <strong>ZIP 压缩包</strong>
          </p>
          <p style={{ marginTop: 8 }}>📋 包含以下 {tables.length} 张表：</p>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <Space wrap>
              {tables.map((t: any) => (
                <Tag key={t.name} color="blue">
                  {t.title}({t.name})
                </Tag>
              ))}
            </Space>
          </div>
        </Card>
      ) : (
        <>
          <Card data-testid="export-fields-section" title="☑️ 字段选择" size="small" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
              <Checkbox
                indeterminate={selFields.length > 0 && selFields.length < fields.length}
                checked={selFields.length === fields.length && fields.length > 0}
                onChange={() => setSelFields(selFields.length === fields.length ? [] : fields.map((f) => f.name))}
              >
                全选{' '}
                <span style={{ color: '#999', fontSize: 12 }}>
                  已选: {selFields.length}/{fields.length}
                </span>
              </Checkbox>
            </div>
            {regular.length > 0 && (
              <>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#1677ff' }}>
                  📄 常规字段 ({regular.length})
                </div>
                <Space wrap style={{ marginBottom: 12 }}>
                  {regular.map((f) => (
                    <Checkbox key={f.name} checked={selFields.includes(f.name)} onChange={() => onToggleField(f.name)}>
                      {(f.uiSchema?.title || f.name) + '(' + f.name + ')'}
                    </Checkbox>
                  ))}
                </Space>
              </>
            )}
            {assoc.length > 0 && (
              <>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#7c3aed', marginBottom: 8 }}>
                  🔗 关联字段 ({assoc.length})
                </div>
                <Space wrap style={{ marginBottom: 12 }}>
                  {assoc.map((f) => (
                    <Checkbox key={f.name} checked={selFields.includes(f.name)} onChange={() => onToggleField(f.name)}>
                      {(f.uiSchema?.title || f.name) + '(' + f.name + ')'}
                    </Checkbox>
                  ))}
                </Space>
              </>
            )}
            {fkFields.length > 0 && (
              <>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#d97706', marginBottom: 8 }}>
                  🔑 关联主键 ({fkFields.length})
                </div>
                <Space wrap>
                  {fkFields.map((f) => (
                    <Checkbox key={f.name} checked={selFields.includes(f.name)} onChange={() => onToggleField(f.name)}>
                      {(f.uiSchema?.title || f.name) + '(' + f.name + ')'}
                    </Checkbox>
                  ))}
                </Space>
              </>
            )}
          </Card>
          {assoc.length > 0 && (
            <Card title="📑 关联数据 Sheet" size="small" style={{ marginBottom: 16 }}>
              <Space>
                <Switch checked={includeAssocSheet} onChange={onIncludeAssocSheetChange} />
                <span>包含关联数据 Sheet</span>
              </Space>
              {includeAssocSheet && (
                <div style={{ marginTop: 8 }}>
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="选择要包含的关联表"
                    value={selectedAssocTables}
                    onChange={onSelectedAssocTablesChange}
                    options={assoc
                      .filter((f) => selFields.includes(f.name))
                      .map((f: any) => ({
                        value: f.name,
                        label: (f.uiSchema?.title || f.name) + '(' + f.name + ')',
                      }))}
                  />
                </div>
              )}
            </Card>
          )}
        </>
      )}
      <Card title="⚙️ 高级选项" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={24}>
            <Space>
              <span style={{ color: '#666', fontWeight: 500 }}>文件命名规则：</span>
              <Input style={{ width: 280 }} value={fileName} onChange={(e) => onFileNameChange(e.target.value)} />
            </Space>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4, marginLeft: 90 }}>
              支持 {`{表名}`} {`{日期}`} 占位符
            </div>
          </Col>
          <Col span={24}>
            <Space>
              <span style={{ color: '#666', fontWeight: 500 }}>表头格式：</span>
              <Radio.Group value={headerStyle} onChange={(e) => onHeaderStyleChange(e.target.value)} size="small">
                <Radio.Button value="title_id">字段名(字段标识)</Radio.Button>
                <Radio.Button value="title">字段名</Radio.Button>
                <Radio.Button value="id">字段标识</Radio.Button>
              </Radio.Group>
            </Space>
          </Col>
          <Col span={24}>
            <Space>
              <Switch checked={includeAttachments} onChange={onIncludeAttachmentsChange} />
              <span style={{ color: '#666' }}>包含附件文件</span>
            </Space>
          </Col>
        </Row>
      </Card>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>
          ← 上一步
        </Button>
        <Button type="primary" onClick={onNext} disabled={!selTable || (!isAllTables && selFields.length === 0)}>
          下一步 →
        </Button>
      </div>
    </div>
  );
}
