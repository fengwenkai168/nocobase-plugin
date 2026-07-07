import React, { useState } from 'react';
import { Card } from 'antd';
import { CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons';

export function CardWrap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card
      title={title}
      size="small"
      style={{ marginBottom: 8, borderRadius: 8 }}
      styles={{ header: { fontSize: 13, fontWeight: 600, minHeight: 36 } }}
    >
      {children}
    </Card>
  );
}

export function CollapseCard({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderRadius: 8 }}
      styles={{ header: { fontSize: 13, fontWeight: 600, minHeight: 36 } }}
      title={
        <span style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
          {open ? <CaretDownOutlined /> : <CaretRightOutlined />} {title}
        </span>
      }
    >
      {open && children}
    </Card>
  );
}

export { TaskSummaryCard } from './TaskSummaryCard';
export { ExportFieldsCard } from './ExportFieldsCard';
export { RelationTablesCard } from './RelationTablesCard';
export { ImportConfigCard } from './ImportConfigCard';
export { FieldMappingCard } from './FieldMappingCard';
export { DataPreviewCard } from './DataPreviewCard';
export { ExecutionLogCard } from './ExecutionLogCard';
