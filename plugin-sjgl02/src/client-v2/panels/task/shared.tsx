import React from 'react';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';

export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: '#d97706', label: 'Pending' },
  processing: { color: '#3b82f6', label: 'Processing' },
  completed: { color: '#059669', label: 'Completed' },
  failed: { color: '#dc2626', label: 'Failed' },
  cancelled: { color: '#6b7280', label: 'Cancelled' },
};

export const LOG_LEVEL_COLORS: Record<string, string> = {
  INFO: '#e2e8f0',
  SUCC: '#22c55e',
  WARN: '#f59e0b',
  ERROR: '#ef4444',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const cfg = STATUS_CONFIG[status] || { color: '#999', label: status };
  return <Tag color={cfg.color}>{t(cfg.label)}</Tag>;
}

export function TableTag({ name, title }: { name: string; title?: string }) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  if (name === '__all__') {
    return <Tag color="#7c3aed">📦 {t('All tables')}</Tag>;
  }
  const label = title || name;
  return (
    <Tag color="#3b82f6">
      📁 {label}({name})
    </Tag>
  );
}

export function FieldTag({ name, title }: { name: string; title?: string }) {
  const label = title || name;
  return (
    <Tag color="#f3f4f6" style={{ color: '#374151', border: '1px solid #d1d5db' }}>
      {label}({name})
    </Tag>
  );
}

export function DataDot({ type, count }: { type: 'success' | 'failed' | 'total'; count: number }) {
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const colors = { success: '#059669', failed: '#dc2626', total: '#9ca3af' };
  const labels = { success: 'Success', failed: 'Failed', total: 'Total' };
  return (
    <span style={{ color: colors[type], marginRight: 12, fontSize: 13 }}>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 4,
          background: colors[type],
          marginRight: 4,
        }}
      />
      {t(labels[type])}：{count}
    </span>
  );
}

export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  const y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}/${M}/${day} ${h}:${m}:${s}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(
  start: string | Date,
  end: string | Date | null | undefined,
  t?: (key: string, options?: any) => string,
): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return t ? t('Duration seconds', { count: seconds }) : `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60)
    return t ? t('Duration minutes seconds', { min: minutes, sec: secs }) : `${minutes} min ${secs} sec`;
  return t
    ? t('Duration hours minutes', { hour: Math.floor(minutes / 60), min: minutes % 60 })
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
