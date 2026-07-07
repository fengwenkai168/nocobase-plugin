import React from 'react';
import { Card, Input, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';
import { useTargetList } from '../../hooks';
import { useAPI } from '../../utils/api';

interface TargetListPanelProps {
  selectedTarget: any;
  onSelectTarget: (target: any) => void;
  onClearSelectedRows: () => void;
}

export default function TargetListPanel({ selectedTarget, onSelectTarget, onClearSelectedRows }: TargetListPanelProps) {
  const api = useAPI();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [searchText, setSearchText] = React.useState('');

  const { targets, loading: loadingTargets } = useTargetList(api);

  const userTargets = targets.filter(
    (item: any) =>
      item.type === 'user' && (!searchText || (item.nickname || '').toLowerCase().includes(searchText.toLowerCase())),
  );
  const roleTargets = targets.filter(
    (item: any) =>
      item.type === 'role' && (!searchText || (item.nickname || '').toLowerCase().includes(searchText.toLowerCase())),
  );

  const groupConfig = [
    { label: `👤 ${t('User')}`, items: userTargets, color: '#1677ff' },
    { label: `👥 ${t('Role')}`, items: roleTargets, color: '#52c41a' },
  ];

  return (
    <Card title={`${t('User')} / ${t('Role')}`} size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
      <Input.Search
        placeholder={t('Search users or roles')}
        allowClear
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      {loadingTargets ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      ) : (
        groupConfig
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <div key={group.label}>
              <div style={{ fontSize: 11, color: '#999', padding: '8px 8px 4px', fontWeight: 600 }}>
                {group.label} ({group.items.length})
              </div>
              {group.items.map((item: any) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    onSelectTarget(item);
                    onClearSelectedRows();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    marginBottom: 2,
                    background:
                      selectedTarget?.id === item.id && selectedTarget?.type === item.type ? '#e6f4ff' : undefined,
                    color: selectedTarget?.id === item.id && selectedTarget?.type === item.type ? '#1677ff' : undefined,
                  }}
                >
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
                      background: item.type === 'user' ? '#1677ff' : '#52c41a',
                    }}
                  >
                    {item.type === 'user' ? 'U' : 'R'}
                  </div>
                  <div>
                    <div>
                      {item.type === 'role' && item.name
                        ? `${item.nickname || item.name}（${item.name}）`
                        : item.nickname || item.name || item.title}
                    </div>
                    {item.type === 'user' && item.roles?.length > 0 && (
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {item.roles.map((r: any) => `${r.title || r.name}（${r.name}）`).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
      )}
    </Card>
  );
}
