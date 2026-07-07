import React, { useState } from 'react';
import { Card, Input, Tag, Button, Space, Checkbox, Popconfirm, Empty, Spin, Pagination, Radio, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
import { useTableList, useViewScope, usePermissions, usePermissionFilter, useTableFields } from '../../hooks';
import { useAPI } from '../../utils/api';
import PermEditModal from './PermEditModal';

interface PermConfigPanelProps {
  selectedTarget: any;
}

export default function PermConfigPanel({ selectedTarget }: PermConfigPanelProps) {
  const api = useAPI();
  const { message } = App.useApp();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });

  const [permSearch, setPermSearch] = useState('');
  const [editModal, setEditModal] = useState<{ open: boolean; perm?: any }>({ open: false });
  const [detailModal, setDetailModal] = useState<{ open: boolean; perm?: any }>({ open: false });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [inheritedOpen, setInheritedOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(true);

  const { tables } = useTableList(api);
  const { viewScope, setViewScope } = useViewScope(api, selectedTarget);
  const { fields, loading: loadingFields, loadFields } = useTableFields(api);
  const {
    perms,
    customPerms,
    loading: loadingPerms,
    isSystemManaged,
    toggle,
    remove,
    save,
  } = usePermissions(api, selectedTarget);
  const filter = usePermissionFilter(perms, tables, permSearch, 10);

  const renderCard = (perm: any) => (
    <Card
      key={perm.tableName + (perm._inherited ? '-i' : '')}
      size="small"
      style={{ marginBottom: 10, ...(perm._inherited ? { background: '#f9f9f9', opacity: 0.85 } : {}) }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!perm._inherited && (
            <Checkbox
              checked={selectedRows.has(perm.tableName)}
              onChange={(e) => {
                const next = new Set(selectedRows);
                e.target.checked ? next.add(perm.tableName) : next.delete(perm.tableName);
                setSelectedRows(next);
              }}
            />
          )}
          <strong>
            {(tables.find((t: any) => t.name === perm.tableName)?.title || perm.tableName) + '(' + perm.tableName + ')'}
          </strong>
          {perm._systemManaged && (
            <Tag color="blue" style={{ fontSize: 10 }}>
              {t('System managed')}
            </Tag>
          )}
          {perm._inherited && !perm._systemManaged && (
            <Tag color="purple" style={{ fontSize: 10 }}>
              {t('Inherited')}
            </Tag>
          )}
        </div>
        <Space>
          {perm._inherited ? (
            <Button size="small" type="link" onClick={() => setDetailModal({ open: true, perm })}>
              {t('View details')}
            </Button>
          ) : (
            <>
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setEditModal({ open: true, perm });
                }}
              >
                {t('Edit')}
              </Button>
              <Button size="small" type="link" danger onClick={() => remove(perm.tableName)}>
                {t('Delete')}
              </Button>
            </>
          )}
        </Space>
      </div>
      <Space wrap size={[6, 6]}>
        <Tag color={perm.canImport ? 'blue' : 'default'}>
          {perm.canImport ? '✅' : '⛔'} {t('Import')}: {perm.canImport ? t('Allow') : t('Disallow')}
        </Tag>
        <Tag color={perm.canExport ? 'green' : 'default'}>
          {perm.canExport ? '✅' : '⛔'} {t('Export')}: {perm.canExport ? t('Allow') : t('Disallow')}
        </Tag>
        {perm.canImport && (
          <>
            <Tag color="orange">
              {t('Import mode')}:{' '}
              {(Array.isArray(perm.importMode) ? perm.importMode : [perm.importMode || 'insert'])
                .map(
                  (m: string) => ({ insert: t('Insert only'), update: t('Update only'), upsert: t('Upsert') })[m] || m,
                )
                .join(' / ')}
            </Tag>
            {perm.uniqueFields?.length > 0 && (
              <Tag color="orange">
                {t('Unique')}: {perm.uniqueFields.join(', ')}
              </Tag>
            )}
            {perm.requiredFields?.length > 0 && (
              <Tag color="red">
                {t('Required')}: {perm.requiredFields.join(', ')}
              </Tag>
            )}
          </>
        )}
        {perm.canImport && (
          <Tag color="cyan">
            {t('Importable fields')}:{' '}
            {perm.importFields?.length > 0 ? t('N fields', { count: perm.importFields.length }) : t('All')}
          </Tag>
        )}
        {perm.canExport && (
          <Tag color="purple">
            {t('Exportable fields')}:{' '}
            {perm.exportFields?.length > 0 ? t('N fields', { count: perm.exportFields.length }) : t('All')}
          </Tag>
        )}
      </Space>
    </Card>
  );

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: '#fff',
                fontWeight: 600,
                background: selectedTarget.type === 'user' ? '#1677ff' : '#52c41a',
              }}
            >
              {selectedTarget.type === 'user' ? 'U' : 'R'}
            </div>
            <strong>
              {selectedTarget.type === 'role' && selectedTarget.name
                ? `${selectedTarget.nickname || selectedTarget.name || selectedTarget.title}（${selectedTarget.name}）`
                : selectedTarget.nickname || selectedTarget.name || selectedTarget.title}
            </strong>
            <Tag color={selectedTarget.type === 'user' ? 'blue' : 'green'}>
              {selectedTarget.type === 'user' ? t('User') : t('Role')}
            </Tag>
            {selectedTarget.type === 'user' && selectedTarget.roles?.length > 0 && (
              <>
                <span style={{ fontSize: 11, color: '#999' }}>{t('Role')}：</span>
                {selectedTarget.roles.map((r: any, i: number) => (
                  <Tag key={i} color={i === 0 ? 'green' : 'orange'} style={{ fontSize: 10 }}>
                    {r.title || r.name}（{r.name}）
                  </Tag>
                ))}
              </>
            )}
          </Space>
          <Space>
            {selectedTarget?.type === 'user' && (
              <>
                <span style={{ fontSize: 12, color: '#666' }}>{t('Task view scope')}：</span>
                <Radio.Group value={viewScope} onChange={(e) => setViewScope(e.target.value)} size="small">
                  <Radio.Button value="own">{t('View own only')}</Radio.Button>
                  <Radio.Button value="all">{t('View all')}</Radio.Button>
                </Radio.Group>
              </>
            )}
            <Button
              type="primary"
              size="small"
              onClick={() => {
                setEditModal({ open: true });
              }}
            >
              + {t('Add permission')}
            </Button>
          </Space>
        </Space>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {!isSystemManaged && customPerms.length > 0 && (
          <>
            <Checkbox
              checked={selectedRows.size > 0 && selectedRows.size === customPerms.length}
              indeterminate={selectedRows.size > 0 && selectedRows.size < customPerms.length}
              onChange={(e) =>
                e.target.checked
                  ? setSelectedRows(new Set(customPerms.map((p: any) => p.tableName)))
                  : setSelectedRows(new Set())
              }
            />
            <span style={{ fontSize: 12, color: '#666' }}>{t('Select all')}</span>
            {selectedRows.size > 0 && (
              <Popconfirm
                title={t('Confirm delete selected permissions', { count: selectedRows.size })}
                onConfirm={() => {
                  selectedRows.forEach((n) => remove(n));
                  setSelectedRows(new Set());
                  message.success(t('Batch delete succeeded'));
                }}
                okText={t('Confirm')}
                cancelText={t('Cancel')}
              >
                <Button size="small" danger>
                  {t('Batch delete')} ({selectedRows.size})
                </Button>
              </Popconfirm>
            )}
          </>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Input.Search
            placeholder={t('Search table name or identifier')}
            allowClear
            size="small"
            style={{ width: 200 }}
            value={permSearch}
            onChange={(v) => setPermSearch(v.target.value)}
          />
        </div>
      </div>

      {loadingPerms ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : filter.isEmpty ? (
        <Empty description={t('No permission configured')} />
      ) : (
        <>
          {(() => {
            const visibleItems = [
              ...(inheritedOpen ? filter.inheritedPerms : []),
              ...(customOpen ? filter.customPerms : []),
            ];
            const visTotal = visibleItems.length;
            const safePage = Math.min(filter.page, Math.max(1, Math.ceil(visTotal / 10)));
            const pagedVis = visibleItems.slice((safePage - 1) * 10, safePage * 10);
            const pagedInh = pagedVis.filter((p: any) => p._inherited);
            const pagedCus = pagedVis.filter((p: any) => !p._inherited);
            return (
              <>
                {filter.inheritedPerms.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div
                      onClick={() => {
                        setInheritedOpen(!inheritedOpen);
                        filter.setPage(1);
                      }}
                      style={{
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#999',
                        marginBottom: 6,
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ marginRight: 4, fontSize: 11 }}>{inheritedOpen ? '▼' : '▶'}</span> 📦
                      {t('Inherited role permissions')} ({t('N items', { count: filter.inheritedPerms.length })})
                    </div>
                    {inheritedOpen && pagedInh.map(renderCard)}
                  </div>
                )}
                {filter.customPerms.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div
                      onClick={() => {
                        setCustomOpen(!customOpen);
                        filter.setPage(1);
                      }}
                      style={{
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 6,
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ marginRight: 4, fontSize: 11 }}>{customOpen ? '▼' : '▶'}</span> ✏️
                      {t('User custom permissions')} ({t('N items', { count: filter.customPerms.length })})
                    </div>
                    {customOpen && pagedCus.map(renderCard)}
                  </div>
                )}
                {visTotal > 10 && (
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <Pagination
                      size="small"
                      current={safePage}
                      total={visTotal}
                      pageSize={10}
                      onChange={filter.setPage}
                    />
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      <PermEditModal
        open={editModal.open}
        perm={editModal.perm}
        tables={tables}
        perms={perms}
        fields={fields}
        loadingFields={loadingFields}
        onSave={save}
        onCancel={() => setEditModal({ open: false })}
        loadFields={loadFields}
      />

      <PermEditModal
        open={detailModal.open}
        perm={detailModal.perm}
        isDetailOnly
        tables={tables}
        perms={perms}
        fields={fields}
        loadingFields={loadingFields}
        onSave={async () => false}
        onCancel={() => setDetailModal({ open: false })}
        loadFields={loadFields}
      />
    </div>
  );
}
