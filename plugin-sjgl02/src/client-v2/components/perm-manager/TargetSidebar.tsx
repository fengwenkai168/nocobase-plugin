import React, { useEffect, useState } from 'react';
import { Avatar, Collapse, Input } from 'antd';
import { useT } from '../../locale';
import { useApi } from '../../services/api';

export interface PermTarget {
  type: 'user' | 'role';
  id: string;
  name: string;
  roleNames?: string[];
  roleTitles?: string;
}

export default function TargetSidebar({
  selected,
  onSelect,
}: {
  selected?: PermTarget;
  onSelect: (target: PermTarget) => void;
}) {
  const t = useT();
  const api = useApi();
  const [users, setUsers] = useState<
    Array<{ id: number; name: string; roles: Array<{ name: string; title?: string }> }>
  >([]);
  const [roles, setRoles] = useState<Array<{ name: string; title: string }>>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    api.getPermTargets().then((res) => {
      setUsers(res.users);
      setRoles(res.roles);
      if (!selected && res.users.length) {
        const first = res.users[0];
        onSelect({
          type: 'user',
          id: String(first.id),
          name: first.name,
          roleNames: first.roles.map((r) => r.name),
          roleTitles: first.roles.map((r) => r.title || r.name).join('·'),
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const match = (text: string) => !keyword || text.toLowerCase().includes(keyword.toLowerCase());
  const cleanTitle = (title: string) => {
    const m = title.match(/^\{\{t\("(.+?)"\)\}\}$/);
    return m ? m[1] : title;
  };

  const itemStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    background: active ? '#e6f4ff' : undefined,
    color: active ? '#1677ff' : undefined,
  });

  const filteredUsers = users.filter((u) => match(u.name) || match(u.roles.map((r) => r.name).join(',')));
  const filteredRoles = roles.filter((r) => match(cleanTitle(r.title)) || match(r.name));

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        padding: 8,
        maxHeight: 640,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, padding: '8px 8px 12px' }}>👥 {t('用户/角色')}</div>
      <Input.Search
        size="small"
        placeholder={t('搜索...')}
        style={{ marginBottom: 8 }}
        onSearch={setKeyword}
        onChange={(e) => setKeyword(e.target.value)}
        allowClear
      />
      <Collapse
        ghost
        defaultActiveKey={['users', 'roles']}
        items={[
          {
            key: 'users',
            label: (
              <span style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>
                👤 {t('用户')} ({filteredUsers.length})
              </span>
            ),
            children: filteredUsers.map((u) => {
              const roleTitles = u.roles.map((r) => cleanTitle(r.title || r.name)).join('·');
              return (
                <div
                  key={u.id}
                  style={itemStyle(selected?.type === 'user' && selected.id === String(u.id))}
                  onClick={() =>
                    onSelect({
                      type: 'user',
                      id: String(u.id),
                      name: u.name,
                      roleNames: u.roles.map((r) => r.name),
                      roleTitles,
                    })
                  }
                >
                  <Avatar size={28} style={{ background: '#1677ff', fontSize: 12, flexShrink: 0 }}>
                    {u.name[0]}
                  </Avatar>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{u.name}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#999',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {roleTitles || '-'}
                    </div>
                  </div>
                </div>
              );
            }),
          },
          {
            key: 'roles',
            label: (
              <span style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>
                🔐 {t('角色')} ({filteredRoles.length})
              </span>
            ),
            children: filteredRoles.map((r) => (
              <div
                key={r.name}
                style={itemStyle(selected?.type === 'role' && selected.id === r.name)}
                onClick={() => onSelect({ type: 'role', id: r.name, name: `${cleanTitle(r.title)}(${r.name})` })}
              >
                <Avatar size={28} style={{ background: '#52c41a', fontSize: 12, flexShrink: 0 }}>
                  R
                </Avatar>
                <div style={{ fontSize: 13 }}>
                  {cleanTitle(r.title)}({r.name})
                </div>
              </div>
            )),
          },
        ]}
      />
    </div>
  );
}
