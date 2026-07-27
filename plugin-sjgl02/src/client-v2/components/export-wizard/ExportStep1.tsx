import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Row, Select } from 'antd';
import { useT } from '../../locale';
import { CollectionOption, useApi } from '../../services/api';
import { ALL_TABLES, ExportWizardState } from './ExportWizard';

export default function ExportStep1({
  state,
  patch,
  onNext,
}: {
  state: ExportWizardState;
  patch: (p: Partial<ExportWizardState>) => void;
  onNext: () => void;
}) {
  const t = useT();
  const api = useApi();
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    api.getExportableCollections().then((res) => {
      setCollections(res.collections);
      setIsAdmin(res.isAdmin);
      patch({ isAdmin: res.isAdmin });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const options = [
    ...(isAdmin ? [{ value: ALL_TABLES, label: `📦 ${t('全部数据表（含系统表）')}` }] : []),
    ...collections.map((c) => ({ value: c.name, label: `📁 ${c.title}(${c.name})` })),
  ];

  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title={`📋 ${t('选择数据表')}`}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>{t('数据表')}</div>
            <Select
              style={{ width: '100%' }}
              placeholder={t('- 请选择数据表 -')}
              value={state.allTables ? ALL_TABLES : state.collection?.name}
              showSearch
              optionFilterProp="label"
              onChange={(v) => {
                if (v === ALL_TABLES) {
                  patch({ allTables: true, collection: { name: ALL_TABLES, title: t('全部数据表（含系统表）') } });
                } else {
                  patch({ allTables: false, collection: collections.find((c) => c.name === v) });
                }
              }}
              options={options}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>💡 {t('仅显示您有权限导出的数据表')}</div>
            <div style={{ fontSize: 12, color: '#999' }}>📊 {t('共 {{count}} 张表可供选择', { count: collections.length })}</div>
            {isAdmin && <div style={{ marginTop: 8, fontSize: 12, color: '#fa8c16' }}>⭐ {t('"全部数据表（含系统表）"仅 admin/root 可见')}</div>}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={`⚙️ ${t('简要配置')}`}>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 2 }}>
              <p>• {t('支持全字段选择和自定义筛选')}</p>
              <p>• {t('关联字段可选择「显示值」「仅ID」或「显示值+主键值」')}</p>
              <p>• {t('关联表可导出为单独Sheet或单独xlsx文件')}</p>
              <p>• {t('支持附件打包导出(tar.gz)')}</p>
              <p>• {t('超百万行自动分新文件')}</p>
              <p>• {t('导出格式固定 xlsx')}</p>
            </div>
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button type="primary" disabled={!state.collection} onClick={onNext}>
          {t('下一步')} →
        </Button>
      </div>
    </div>
  );
}
