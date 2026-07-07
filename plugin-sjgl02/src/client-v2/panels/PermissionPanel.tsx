import React, { useState } from 'react';
import { Row, Col, Empty, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../locale';
import { useAPI } from '../utils/api';
import TargetListPanel from './permission/TargetListPanel';
import PermConfigPanel from './permission/PermConfigPanel';
import AuditLogPanel from './permission/AuditLogPanel';

export default function PermissionTab() {
  const api = useAPI();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [subTab, setSubTab] = useState('perm');

  return (
    <div>
      <Row gutter={20}>
        <Col span={6}>
          <TargetListPanel
            selectedTarget={selectedTarget}
            onSelectTarget={setSelectedTarget}
            onClearSelectedRows={() => {}}
          />
        </Col>
        <Col span={18}>
          {!selectedTarget ? (
            <Empty description={t('Please select a user or role on the left')} />
          ) : (
            <div>
              <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0', marginBottom: 12 }}>
                <div
                  onClick={() => setSubTab('perm')}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: 13,
                    borderBottom: subTab === 'perm' ? '2px solid #1677ff' : '2px solid transparent',
                    color: subTab === 'perm' ? '#1677ff' : '#999',
                    fontWeight: subTab === 'perm' ? 600 : 400,
                    marginBottom: -2,
                  }}
                >
                  ✓ {t('Permission settings')}
                </div>
                <div
                  onClick={() => setSubTab('log')}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: 13,
                    borderBottom: subTab === 'log' ? '2px solid #1677ff' : '2px solid transparent',
                    color: subTab === 'log' ? '#1677ff' : '#999',
                    fontWeight: subTab === 'log' ? 600 : 400,
                    marginBottom: -2,
                  }}
                >
                  📋 {t('Operation log')}
                </div>
              </div>

              {subTab === 'log' ? (
                <AuditLogPanel visible={subTab === 'log'} />
              ) : (
                <PermConfigPanel selectedTarget={selectedTarget} />
              )}
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
}
