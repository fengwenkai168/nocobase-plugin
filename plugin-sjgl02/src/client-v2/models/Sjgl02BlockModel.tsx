import React, { Suspense, lazy } from 'react';
import { BlockModel } from '@nocobase/client-v2';
import { tExpr } from '../locale';

const BlockContent = lazy(() => import('../pages/BlockContent'));

export class Sjgl02BlockModel extends BlockModel {
  renderComponent() {
    return (
      <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#999' }}>Loading...</div>}>
        <BlockContent />
      </Suspense>
    );
  }
}

Sjgl02BlockModel.define({
  label: tExpr('数据管理02-sjgl02'),
});
