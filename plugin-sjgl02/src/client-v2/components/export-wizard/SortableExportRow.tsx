import React, { useState } from 'react';
import { Button, InputNumber } from 'antd';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined } from '@ant-design/icons';

export default function SortableExportRow({
  id,
  index,
  label,
  total,
  extra,
  onRemove,
  onMove,
  onJumpTo,
}: {
  id: string;
  index: number;
  label: string;
  total: number;
  extra?: React.ReactNode;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
  onJumpTo?: (targetIndex: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: isDragging ? '#e6f4ff' : '#fafafa',
    borderRadius: 4,
    border: '1px solid #f0f0f0',
    marginBottom: 4,
    cursor: 'default',
  };
  const commitMove = (target: number) => {
    const clamped = Math.max(1, Math.min(target, total));
    if (clamped !== index + 1 && onJumpTo) {
      onJumpTo(clamped - 1);
    }
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#999', flexShrink: 0 }}>
        <HolderOutlined />
      </span>
      {editIndex !== null ? (
        <InputNumber
          size="small"
          min={1}
          max={total}
          value={editIndex}
          style={{ width: 48 }}
          autoFocus
          onChange={(v) => setEditIndex(v ?? 1)}
          onPressEnter={() => {
            commitMove(editIndex);
            setEditIndex(null);
          }}
          onBlur={() => {
            commitMove(editIndex);
            setEditIndex(null);
          }}
        />
      ) : (
        <span
          style={{ width: 24, textAlign: 'center', color: '#999', fontSize: 12, flexShrink: 0, cursor: 'pointer' }}
          onClick={() => setEditIndex(index + 1)}
        >
          {index + 1}
        </span>
      )}
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {extra}
      <Button
        type="text"
        size="small"
        disabled={index === 0}
        onClick={() => onMove('up')}
        style={{ padding: '0 4px', fontSize: 12 }}
      >
        ↑
      </Button>
      <Button
        type="text"
        size="small"
        disabled={index === total - 1}
        onClick={() => onMove('down')}
        style={{ padding: '0 4px', fontSize: 12 }}
      >
        ↓
      </Button>
      <Button type="text" size="small" danger onClick={onRemove} style={{ padding: '0 4px', fontSize: 12 }}>
        ×
      </Button>
    </div>
  );
}
