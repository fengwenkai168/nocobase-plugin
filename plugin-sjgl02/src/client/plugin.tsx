import { Plugin } from '@nocobase/client';
import React from 'react';
import { Card, Tabs, Button, Space, Steps, Select, Upload, Table, Tag, Statistic, Row, Col, Progress, Drawer, Descriptions, Switch, Modal, Form, Input, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

function Sjgl02Block() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: 'linear-gradient(135deg,#1677ff,#0958d9)', borderRadius: 10, padding: '10px 20px', color: '#fff', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>数据管理</div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>@my-project/plugin-sjgl02 v1.0.0</div>
      </div>
      <Tabs
        items={[
          { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
          { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
          { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
        ]}
      />
    </div>
  );
}

function Sjgl02SettingsPageV1() {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{
        background: 'linear-gradient(135deg,#1677ff,#0958d9)',
        borderRadius: 12, padding: '14px 24px', color: '#fff', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>数据管理</div>
          <div style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>
            导入导出 · 任务管理 · 表级权限控制
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 11 }}>
          @my-project/plugin-sjgl02 v1.0.0
        </div>
      </div>
      <Card style={{ borderRadius: 10, minHeight: 500 }}>
        <Tabs
          defaultActiveKey="import"
          items={[
            { key: 'import', label: '⬇ 导入', children: <ImportPanel /> },
            { key: 'export', label: '⬆ 导出', children: <ExportPanel /> },
            { key: 'tasks', label: '☰ 任务管理', children: <TaskPanel /> },
            { key: 'permissions', label: '✓ 权限管理', children: <PermissionPanel /> },
          ]}
        />
      </Card>
    </div>
  );
}

function ImportPanel() {
  const [step, setStep] = React.useState(0);
  return (
    <div>
      <Steps current={step} items={[{ title: '选择数据表' }, { title: '上传文件 & 字段映射' }, { title: '预览 & 执行' }]} style={{ marginBottom: 24 }} />
      {step === 0 && <ImportStep1 onNext={() => setStep(1)} />}
      {step === 1 && <ImportStep2 onPrev={() => setStep(0)} onNext={() => setStep(2)} />}
      {step === 2 && <ImportStep3 onPrev={() => setStep(1)} />}
    </div>
  );
}

function ImportStep1({ onNext }: { onNext: () => void }) {
  const [table, setTable] = React.useState<string | undefined>();
  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="选择目标数据表" size="small">
            <Select
              style={{ width: '100%' }}
              placeholder="— 请选择数据表 —"
              value={table}
              onChange={setTable}
              options={[
                { value: 'users', label: '📁 用户 (users)' },
                { value: 'roles', label: '📁 角色 (roles)' },
                { value: 'orders', label: '📁 订单 (orders)' },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="导入说明" size="small">
            <ul style={{ color: '#666', lineHeight: 1.9, paddingLeft: 16, fontSize: 13 }}>
              <li>支持 <strong>.xlsx</strong> / <strong>.xls</strong> / <strong>.csv</strong></li>
              <li>最大 <strong>50 MB</strong></li>
              <li>三种模式：<Tag color="blue">新增</Tag> <Tag color="green">更新</Tag> <Tag color="orange">新增+更新</Tag></li>
              <li>必填字段自动标记 <span style={{ color: '#ff4d4f' }}>*</span></li>
            </ul>
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <Button type="primary" disabled={!table} onClick={onNext}>下一步 →</Button>
      </div>
    </div>
  );
}

function ImportStep2({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div>
      <Upload.Dragger name="file" accept=".xlsx,.xls,.csv" style={{ marginBottom: 12 }}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽上传文件</p>
        <p className="ant-upload-hint">支持 .xlsx / .xls / .csv，最大 50MB</p>
      </Upload.Dragger>
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>← 上一步</Button>
        <Button type="primary" onClick={onNext}>下一步 →</Button>
      </div>
    </div>
  );
}

function ImportStep3({ onPrev }: { onPrev: () => void }) {
  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[{ n: '1,256', l: '预计导入行数' }, { n: '0', l: '错误行数', c: '#52c41a' }, { n: '新增', l: '导入模式' }, { n: 'Sheet1', l: 'Sheet名称' }].map(({ n, l, c }) => (
          <Col span={6} key={l}>
            <Card size="small"><Statistic title={l} value={n} valueStyle={c ? { color: c, fontSize: 20 } : { fontSize: 20 }} /></Card>
          </Col>
        ))}
      </Row>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>预览数据（前10行）</div>
      <Table
        dataSource={[
          { key: '1', 姓名: '张三', 手机号: '13800138001', 年龄: 28 },
          { key: '2', 姓名: '李四', 手机号: '13800138002', 年龄: 35 },
        ]}
        columns={[{ title: '姓名', dataIndex: '姓名' }, { title: '手机号', dataIndex: '手机号' }, { title: '年龄', dataIndex: '年龄' }]}
        pagination={false} size="small"
      />
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={onPrev} style={{ marginRight: 8 }}>← 上一步</Button>
        <Button type="primary">▶ 执行导入</Button>
      </div>
    </div>
  );
}

function ExportPanel() {
  const [step, setStep] = React.useState(0);
  return (
    <div>
      <Steps current={step} items={[{ title: '选择数据表' }, { title: '选择字段 & 配置' }, { title: '执行导出' }]} style={{ marginBottom: 24 }} />
      {step === 0 && (
        <div>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="选择数据表" size="small">
                <Select style={{ width: '100%' }} placeholder="— 请选择数据表 —"
                  options={[
                    { value: '__all__', label: '📦 全部数据表（含系统表）' },
                    { value: 'users', label: '📁 用户 (users)' },
                    { value: 'orders', label: '📁 订单 (orders)' },
                  ]}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="简要配置" size="small">
                <ul style={{ color: '#666', paddingLeft: 16, fontSize: 13, lineHeight: 1.9 }}>
                  <li>支持全字段选择和自定义筛选</li>
                  <li>关联字段可选「显示值」或「仅ID」</li>
                  <li>支持生成关联数据独立 Sheet</li>
                </ul>
              </Card>
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button type="primary" onClick={() => setStep(1)}>下一步 →</Button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          <Card title="字段选择" size="small" style={{ marginBottom: 12 }}>
            <Space wrap>
              {['姓名', '手机号', '邮箱', '年龄', '地址', '创建时间', '角色', '部门', '头像'].map(f => (
                <Tag.CheckableTag key={f} checked={true}>{f}</Tag.CheckableTag>
              ))}
            </Space>
          </Card>
          <Card title="数据范围" size="small" style={{ marginBottom: 12 }}>
            <Space>
              <Button type="primary" size="small">全部数据</Button>
              <Button size="small">自定义条件</Button>
            </Space>
          </Card>
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setStep(0)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary" onClick={() => setStep(2)}>下一步 →</Button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="选择字段" value={9} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="预计行数" value={5230} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="数据范围" value="全部数据" /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="生成文件" value=".xlsx" /></Card></Col>
          </Row>
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setStep(1)} style={{ marginRight: 8 }}>← 上一步</Button>
            <Button type="primary">▶ 执行导出</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskPanel() {
  const [drawer, setDrawer] = React.useState<{ open: boolean; task: any }>({ open: false, task: null });
  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrapr>
          <span style={{ color: '#666' }}>类型：</span>
          <Select defaultValue="all" size="small" style={{ width: 100 }} options={[{ value: 'all', label: '全部' }, { value: 'import', label: '导入' }, { value: 'export', label: '导出' }]} />
          <span style={{ color: '#666' }}>状态：</span>
          <Select defaultValue="all" size="small" style={{ width: 100 }} options={[{ value: 'all', label: '全部' }, { value: 'pending', label: '排队中' }, { value: 'processing', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'failed', label: '失败' }]} />
        </Space>
      </Card>
      <Table
        dataSource={[
          { key: '1', id: 1001, taskType: 'import', tableName: 'users', status: 'completed', progress: 100, totalRows: 1256, processedRows: 1256, createdBy: 'Super Admin', createdAt: '2026-06-22 10:00', completedAt: '2026-06-22 10:02' },
          { key: '2', id: 1002, taskType: 'export', tableName: 'orders', status: 'processing', progress: 45, totalRows: 5230, processedRows: 2354, createdBy: 'Super Admin', createdAt: '2026-06-22 10:30', completedAt: null },
        ]}
        columns={[
          { title: '任务ID', dataIndex: 'id', render: (v: number) => `#${v}` },
          { title: '类型', dataIndex: 'taskType', render: (v: string) => <Tag color={v === 'import' ? 'blue' : 'green'}>{v === 'import' ? '导入' : '导出'}</Tag> },
          { title: '目标表', dataIndex: 'tableName' },
          { title: '状态', dataIndex: 'status', render: (v: string) => {
            const m: any = { pending: { c: 'orange', t: '排队中' }, processing: { c: 'blue', t: '进行中' }, completed: { c: 'green', t: '已完成' }, failed: { c: 'red', t: '失败' } };
            return <Tag color={m[v]?.c}>{m[v]?.t || v}</Tag>;
          }},
          { title: '进度', dataIndex: 'progress', render: (v: number) => <Progress percent={v} size="small" /> },
          { title: '数据量', render: (_: any, r: any) => `${r.processedRows}/${r.totalRows}` },
          { title: '创建人', dataIndex: 'createdBy' },
          { title: '创建时间', dataIndex: 'createdAt' },
          { title: '完成时间', dataIndex: 'completedAt', render: (v: any) => v || '—' },
          { title: '操作', render: () => <Button type="link" size="small">👁 查看</Button> },
        ]}
        size="small" pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

function PermissionPanel() {
  const [target, setTarget] = React.useState<any>(null);
  return (
    <Row gutter={20}>
      <Col span={6}>
        <Card title="用户 / 角色" size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
          {[
            { id: 1, name: 'Super Admin', type: 'user', color: '#1677ff' },
            { id: 1, name: '管理员', type: 'role', color: '#52c41a' },
          ].map(t => (
            <div key={`${t.type}-${t.id}`} onClick={() => setTarget(t)}
              style={{
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 2,
                background: target?.id === t.id && target?.type === t.type ? '#e6f4ff' : undefined,
                color: target?.id === t.id && target?.type === t.type ? '#1677ff' : undefined,
              }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12 }}>
                {t.type === 'user' ? 'U' : 'R'}
              </div>
              <span>{t.name}</span>
            </div>
          ))}
        </Card>
      </Col>
      <Col span={18}>
        {target ? (
          <div>
            <Card size="small" style={{ marginBottom: 12 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <Tag color={target.type === 'user' ? 'blue' : 'green'}>{target.type === 'user' ? '用户' : '角色'}</Tag>
                  <strong>{target.name}</strong>
                </Space>
                <Button type="primary" size="small">+ 添加权限</Button>
              </Space>
            </Card>
            {['users', 'orders'].map(t => (
              <Card key={t} size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <strong>{t}</strong>
                    <Switch checkedChildren="导入" unCheckedChildren="导入" defaultChecked />
                    <Switch checkedChildren="导出" unCheckedChildren="导出" defaultChecked />
                  </Space>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Tag color="blue">导入: 是</Tag>
                  <Tag color="green">导出: 是</Tag>
                  <Tag color="orange">导入模式: insert</Tag>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card><div style={{ textAlign: 'center', color: '#999', padding: 40 }}>请选择左侧用户或角色</div></Card>
        )}
      </Col>
    </Row>
  );
}

export class PluginSjgl02Client extends Plugin {
  async load() {
    // 注册设置菜单入口（v1 管理后台可见）
    this.pluginSettingsManager.add('sjgl02', {
      title: '数据管理',
      icon: 'DatabaseOutlined',
      Component: Sjgl02SettingsPageV1,
    });

    // 注册区块组件
    this.app.addComponents({ SjglBlock: Sjgl02Block });

    // 注册区块初始化器（v2 页面添加区块菜单）
    this.app.schemaInitializerManager.addItem('page:addBlock', 'sjgl02.block', {
      title: '数据管理',
      Component: 'SjglBlock',
    });
    this.app.schemaInitializerManager.addItem('popup:common:addBlock', 'sjgl02.block', {
      title: '数据管理',
      Component: 'SjglBlock',
    });
  }
}
