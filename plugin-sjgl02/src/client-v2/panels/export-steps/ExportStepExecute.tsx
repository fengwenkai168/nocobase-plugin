import React from 'react';
import { Card, Button, Statistic, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';

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
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title={t('Selected fields')} value={isAllTables ? t('All') : selFieldsCount} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title={t('Estimated rows')} value={estimatedRows ?? '...'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title={t('File name')} value={fileName} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title={t('Format')} value={isAllTables ? '.zip' : includeAttachments ? '.zip' : '.xlsx'} />
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right' }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>
          ← {t('Previous step')}
        </Button>
        <Button data-testid="export-execute-btn" type="primary" onClick={onExport}>
          ▶ {t('Execute export')}
        </Button>
      </div>
    </div>
  );
}
