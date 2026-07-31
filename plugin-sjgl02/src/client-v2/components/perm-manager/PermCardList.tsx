import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Collapse, Modal, Space, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons';
import { useT } from '../../locale';
import { modeLabel, modeShortLabel } from '../import-wizard/modeLabels';
import { PermRecord, useApi } from '../../services/api';

function useFieldLabels(records: PermRecord[]) {
  const api = useApi();
  const [fieldMaps, setFieldMaps] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    const names = [...new Set(records.map((r) => r.collectionName))];
    const missing = names.filter((n) => n && !fieldMaps[n]);
    if (!missing.length) return;
    Promise.all(
      missing.map(async (n) => {
        try {
          const meta = await api.getCollectionMeta(n);
          const map: Record<string, string> = {};
          for (const f of meta.fields) map[f.name] = f.title;
          return [n, map] as const;
        } catch {
          return [n, {}] as const;
        }
      }),
    ).then((entries) => {
      setFieldMaps((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.map((r) => r.collectionName).join(',')]);
  const labelOf = (collectionName: string, name: string) => {
    const title = fieldMaps[collectionName]?.[name];
    return title ? `${title}(${name})` : name;
  };
  return { labelOf };
}

export function PermTags({
  record,
  labelOf,
}: {
  record: PermRecord;
  labelOf: (collectionName: string, name: string) => string;
}) {
  const t = useT();
  return (
    <Space size={4} wrap>
      <Tag color="blue">
        {t('导入')}:{record.canImport ? t('是') : t('否')}
      </Tag>
      <Tag color="green">
        {t('导出')}:{record.canExport ? t('是') : t('否')}
      </Tag>
      {(record.importModes || []).length > 0 && (
        <Tag color="orange">
          {t('模式')}:{record.importModes!.map((m) => modeShortLabel(t, m)).join('/')}
        </Tag>
      )}
      {(record.uniqueFields || []).length > 0 && (
        <Tag color="orange">
          {t('唯一值')}:{record.uniqueFields!.map((f) => labelOf(record.collectionName, f)).join(',')}
        </Tag>
      )}
      {(record.requiredFields || []).length > 0 && (
        <Tag color="red">
          {t('必填')}:{record.requiredFields!.map((f) => labelOf(record.collectionName, f)).join(',')}
        </Tag>
      )}
      <Tag color="cyan">
        {t('可导入')}:{(record.importFields || []).length ? `${record.importFields!.length}${t('个字段')}` : t('全部')}
      </Tag>
      {record.canExport && (
        <Tag color="purple">
          {t('可导出')}:
          {(record.exportFields || []).length ? `${record.exportFields!.length}${t('个字段')}` : t('全部')}
        </Tag>
      )}
      {!!record.exportFilter && Object.keys(record.exportFilter as object).length > 0 && (
        <Tag>
          <FileTextOutlined /> {t('筛选')}
        </Tag>
      )}
    </Space>
  );
}

export default function PermCardList({
  own,
  inherited,
  isUser,
  onEdit,
  onDelete,
  refreshKey,
}: {
  own: PermRecord[];
  inherited: Array<{ roleName: string; roleTitle: string; items: PermRecord[]; isAdmin: boolean }>;
  isUser: boolean;
  onEdit: (record?: PermRecord) => void;
  onDelete: (record: PermRecord) => void;
  refreshKey: number;
}) {
  const t = useT();
  const [detail, setDetail] = useState<PermRecord | null>(null);
  const allRecords = [...own, ...inherited.flatMap((g) => g.items)];
  const { labelOf } = useFieldLabels(allRecords);

  return (
    <div>
      {isUser && inherited.length > 0 && (
        <Collapse
          defaultActiveKey={['inherited']}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'inherited',
              label: `📦 ${t('角色继承的权限（按角色分组）')}（${t('只读，不可编辑')}）`,
              children: inherited.map((group) => (
                <Collapse
                  key={group.roleName}
                  defaultActiveKey={[group.roleName]}
                  style={{ marginBottom: 8 }}
                  items={[
                    {
                      key: group.roleName,
                      label: `🔐 ${t('来自')} ${group.roleTitle}(${group.roleName})`,
                      children: group.isAdmin ? (
                        <Alert
                          type="error"
                          showIcon
                          message={<strong>{t('该角色拥有全部权限')}</strong>}
                          description={t(
                            'admin/root 角色自动拥有所有数据表的导入、导出、全部模式、全部字段权限，包括系统表导出权限。不可修改、不可删除。',
                          )}
                        />
                      ) : group.items.length === 0 ? (
                        <div style={{ color: '#999', fontSize: 12 }}>{t('该角色无权限配置')}</div>
                      ) : (
                        group.items.map((record) => (
                          <Card key={record.id} size="small" style={{ marginBottom: 8, background: '#f9f9f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span>
                                <strong>
                                  {record.collectionTitle || record.collectionName}({record.collectionName})
                                </strong>{' '}
                                <Tag color="purple">{t('继承')}</Tag>
                              </span>
                              <Button type="link" size="small" onClick={() => setDetail(record)}>
                                {t('查看详情')}
                              </Button>
                            </div>
                            <PermTags record={record} labelOf={labelOf} />
                          </Card>
                        ))
                      ),
                    },
                  ]}
                />
              )),
            },
          ]}
        />
      )}

      <Collapse
        defaultActiveKey={['custom']}
        items={[
          {
            key: 'custom',
            label: (
              <span>
                <EditOutlined /> {isUser ? t('用户自定义权限') : t('角色权限配置')}（{own.length}
                {t('条')}）
              </span>
            ),
            children:
              own.length === 0 ? (
                <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>
                  {t('暂无权限配置，点击右上角「+ 添加权限配置」创建')}
                </div>
              ) : (
                own.map((record) => (
                  <Card key={record.id} size="small" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong>
                        {record.collectionTitle || record.collectionName}({record.collectionName})
                      </strong>
                      <Space size={4}>
                        <Button type="link" size="small" onClick={() => onEdit(record)}>
                          <EditOutlined /> {t('编辑')}
                        </Button>
                        <Button type="link" size="small" danger onClick={() => onDelete(record)}>
                          <DeleteOutlined /> {t('删除')}
                        </Button>
                      </Space>
                    </div>
                    <PermTags record={record} labelOf={labelOf} />
                  </Card>
                ))
              ),
          },
        ]}
      />

      <Modal
        title={
          <span>
            <FileTextOutlined /> {t('查看权限详情')}
          </span>
        }
        open={!!detail}
        footer={<Button onClick={() => setDetail(null)}>{t('关闭')}</Button>}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('此权限为继承权限，不可在此编辑。')} />
            <Table
              size="small"
              pagination={false}
              showHeader={false}
              dataSource={[
                ['数据表', `${detail.collectionTitle || detail.collectionName}(${detail.collectionName})`],
                ['允许导入', detail.canImport ? <Tag color="blue">是</Tag> : <Tag>否</Tag>],
                ['允许导出', detail.canExport ? <Tag color="blue">是</Tag> : <Tag>否</Tag>],
                [
                  '导入模式',
                  (detail.importModes || []).length
                    ? detail.importModes!.map((m) => (
                        <Tag key={m} color="orange">
                          {modeLabel(t, m)}
                        </Tag>
                      ))
                    : '-',
                ],
                [
                  '唯一值字段',
                  (detail.uniqueFields || []).length
                    ? detail.uniqueFields!.map((f) => (
                        <Tag key={f} color="orange">
                          {labelOf(detail.collectionName, f)}
                        </Tag>
                      ))
                    : '-',
                ],
                [
                  '必填字段',
                  (detail.requiredFields || []).length
                    ? detail.requiredFields!.map((f) => (
                        <Tag key={f} color="red">
                          {labelOf(detail.collectionName, f)}
                        </Tag>
                      ))
                    : '-',
                ],
                [
                  '可导入字段',
                  (detail.importFields || []).length ? (
                    detail.importFields!.map((f) => labelOf(detail.collectionName, f)).join(', ')
                  ) : (
                    <span style={{ color: '#52c41a' }}>{t('全部字段允许（未限制）')}</span>
                  ),
                ],
                [
                  '可导出字段',
                  (detail.exportFields || []).length ? (
                    detail.exportFields!.map((f) => labelOf(detail.collectionName, f)).join(', ')
                  ) : (
                    <span style={{ color: '#52c41a' }}>{t('全部字段允许（未限制）')}</span>
                  ),
                ],
                [
                  '导出筛选',
                  detail.exportFilter && Object.keys(detail.exportFilter as object).length ? (
                    JSON.stringify(detail.exportFilter)
                  ) : (
                    <span style={{ color: '#999' }}>{t('无筛选条件')}</span>
                  ),
                ],
              ].map(([label, value], i) => ({ key: i, label, value }))}
              columns={[
                { dataIndex: 'label', width: 100, render: (v: string) => <span style={{ color: '#666' }}>{v}</span> },
                { dataIndex: 'value' },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
