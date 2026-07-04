// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { Button, Empty, Space } from 'antd';
import { CaretDownOutlined, CaretRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { LOG_LEVEL_COLORS, formatTime } from './shared';

export function ExecutionLogViewer({ api, taskId, status }: { api: any; taskId: number; status: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  const fetchLogs = async () => {
    try {
      const res = await api.request({ url: 'sjgl02TaskLogs:list', method: 'get', params: { taskId, pageSize: 200 } });
      const data = res?.data?.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      setLogs(items);
    } catch {
      // 日志表可能尚未创建，静默处理
      if (logs.length === 0) setLogs([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));

    if (status === 'processing' || status === 'pending') {
      timerRef.current = setInterval(fetchLogs, 2000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [taskId, status]);

  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, collapsed]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchLogs();
    setLoading(false);
  };

  if (collapsed) {
    return (
      <div style={{ cursor: 'pointer', padding: '12px 16px', background: '#1e293b', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: 13 }}
        onClick={() => setCollapsed(false)}>
        <Space><CaretRightOutlined /> 📋 执行日志 ({logs.length} 条)</Space>
        <span style={{ fontSize: 11 }}>{status === 'processing' ? '自动刷新中' : ''}</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ cursor: 'pointer', padding: '12px 16px', background: '#1e293b', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: 13, borderBottom: '1px solid #334155' }}
        onClick={() => setCollapsed(true)}>
        <Space><CaretDownOutlined /> 📋 执行日志 ({logs.length} 条)</Space>
        <Space>
          <span style={{ fontSize: 11, opacity: 0.7 }}>{status === 'processing' ? '每 2 秒自动刷新' : ''}</span>
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={(e) => { e.stopPropagation(); handleRefresh(); }} style={{ color: '#94a3b8' }} />
        </Space>
      </div>
      <div ref={scrollRef} style={{
        background: '#1e293b', borderRadius: '0 0 8px 8px', padding: '12px 16px',
        maxHeight: 420, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8,
      }}>
        {loading && logs.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>加载中...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20, lineHeight: 2 }}>
            暂无执行日志<br />
            <span style={{ fontSize: 11, opacity: 0.6 }}>历史任务或 v1.0.64 之前的任务不含日志记录</span>
          </div>
        ) : (
          logs.map((log: any, i: number) => (
             <div key={i} style={{ color: '#e2e8f0', marginBottom: 4, wordBreak: 'break-word' }}>
              <span style={{ color: '#64748b' }}>{formatTime(log.timestamp).split(' ')[1]}</span>
              {'  '}
              <span style={{ color: LOG_LEVEL_COLORS[log.level] || '#e2e8f0', fontWeight: 600, minWidth: 52, display: 'inline-block' }}>[{log.level}]</span>
              {'  '}
              <span style={{ color: log.level === 'ERROR' ? '#fca5a5' : '#e2e8f0', whiteSpace: 'pre-wrap' }}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
