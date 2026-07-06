import React from 'react';
import { Card, Button, Statistic, Row, Col } from 'antd';

interface ExportStepExecuteProps {
  isAllTables: boolean;
  selFieldsCount: number;
  estimatedRows: number | null;
  fileName: string;
  includeAttachments: boolean;
  onPrev: () => void;
  onExport: () => void;
}

export default function ExportStepExecute({
  isAllTables,
  selFieldsCount,
  estimatedRows,
  fileName,
  includeAttachments,
  onPrev,
  onExport,
}: ExportStepExecuteProps) {
  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="选择字段" value={isAllTables ? '全部' : selFieldsCount} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="预计行数" value={estimatedRows ?? '...'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="文件命名" value={fileName} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="格式" value={isAllTables ? '.zip' : includeAttachments ? '.zip' : '.xlsx'} />
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right' }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>
          ← 上一步
        </Button>
        <Button data-testid="export-execute-btn" type="primary" onClick={onExport}>
          ▶ 执行导出
        </Button>
      </div>
    </div>
  );
}
