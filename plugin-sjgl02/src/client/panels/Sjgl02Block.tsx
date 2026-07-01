import React from 'react';
import { useAPIClient } from '@nocobase/client';
import { Card, Tabs, Button, Space, Select, Table, Tag, Statistic, Row, Col, Input, InputNumber, message, Checkbox, Switch, Steps, Progress, Empty, Descriptions, Drawer, Modal, Form, Radio, Upload, Pagination, Alert } from 'antd';
import { InboxOutlined, TableOutlined } from '@ant-design/icons';
import { VERSION, apiRequest } from './shared';
import ImportPanel from './ImportPanel';
import ExportPanel from './ExportPanel';
import TaskPanel from './TaskPanel';

const { Dragger } = Upload;

export default function Sjgl02Block() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: 'linear-gradient(135deg,#1677ff,#0958d9)', borderRadius: 10, padding: '10px 20px', color: '#fff', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>📊 数据管理</div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>@my-project/plugin-sjgl02 {VERSION}</div>
      </div>
      <Tabs destroyInactiveTabPane items={[
        { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
        { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
        { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
      ]} />
    </div>
  );
}
