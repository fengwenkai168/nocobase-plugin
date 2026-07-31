import React, { useEffect, useState } from 'react';
import { Button, Collapse, InputNumber, Select, Tag } from 'antd';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined } from '@ant-design/icons';
import { useT } from '../../locale';

export function ChipsSelect({
  options,
  value,
  onChange,
  color,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  color: string;
  placeholder: string;
}) {
  const remaining = options.filter((o) => !value.includes(o.value));
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: 4,
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        minHeight: 36,
        alignItems: 'center',
      }}
    >
      {value.map((v) => (
        <Tag key={v} color={color} closable onClose={() => onChange(value.filter((x) => x !== v))}>
          {options.find((o) => o.value === v)?.label || v}
        </Tag>
      ))}
      <Select
        size="small"
        style={{ minWidth: 120 }}
        placeholder={placeholder}
        value={null}
        onChange={(v) => onChange([...value, v])}
        options={remaining}
        showSearch
        optionFilterProp="label"
        filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
      />
    </div>
  );
}

function SortableRow({
  id,
  index,
  label,
  total,
  onRemove,
  onMove,
}: {
  id: string;
  index: number;
  label: string;
  total: number;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
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
    if (clamped !== index + 1) {
      const newIndex = clamped - 1;
      const event = new CustomEvent('sjgl02-row-move', { detail: { from: index, to: newIndex } });
      window.dispatchEvent(event);
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

export function SortableFieldList({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const t = useT();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const remaining = options.filter((o) => !value.includes(o.value));
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label || v;

  const handleDragEnd = (e: { active: { id: string | number }; over: { id: string | number } | null }) => {
    if (e.over && e.active.id !== e.over.id) {
      const oldIndex = value.indexOf(String(e.active.id));
      const newIndex = value.indexOf(String(e.over.id));
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };
  const move = (index: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < value.length) onChange(arrayMove(value, index, target));
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const { from, to } = (e as CustomEvent).detail;
      if (from !== to) onChange(arrayMove(value, from, to));
    };
    window.addEventListener('sjgl02-row-move', handler);
    return () => window.removeEventListener('sjgl02-row-move', handler);
  }, [value, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 8, minHeight: 36 }}>
        {value.length === 0 && (
          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>{t('未选择字段')}</div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={value} strategy={verticalListSortingStrategy}>
            {value.map((v, i) => (
              <SortableRow
                key={v}
                id={v}
                index={i}
                label={labelOf(v)}
                total={value.length}
                onRemove={() => onChange(value.filter((x) => x !== v))}
                onMove={(dir) => move(i, dir)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {remaining.length > 0 && (
          <Select
            size="small"
            style={{ minWidth: 160, marginTop: 4 }}
            placeholder={placeholder}
            value={null}
            onChange={(v) => onChange([...value, v])}
            options={remaining}
            showSearch
            optionFilterProp="label"
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          />
        )}
      </div>
    </div>
  );
}

export function FieldBlock({
  title,
  required,
  children,
  defaultOpen = true,
  extra,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <Collapse
      ghost
      defaultActiveKey={defaultOpen ? ['1'] : []}
      size="small"
      style={{ marginBottom: 4 }}
      items={[
        {
          key: '1',
          label: (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingRight: 8,
              }}
            >
              <span style={{ fontSize: 12, color: '#666' }}>
                {title}
                {required && <span style={{ color: '#ff4d4f' }}> *</span>}
              </span>
              <span onClick={(e) => e.stopPropagation()}>{extra}</span>
            </div>
          ),
          children,
        },
      ]}
    />
  );
}
