import React, { useMemo } from 'react';
import { CollectionFilterPanel, CompiledFilter } from '@nocobase/client-v2';
import { useFlowContext } from '@nocobase/flow-engine';
import { Empty } from 'antd';
import { useT } from '../../locale';
import { ExportWizardState } from './ExportWizard';
import { DATE_TYPES, RELATION_TYPES } from './export-options';

/**
 * 导出筛选条件（复用系统 CollectionFilterPanel）：
 * - 字段树选（Cascader）+ 按字段类型动态操作符 + 专属值控件（日期/枚举/数字等）
 * - 支持 AND/OR 与嵌套分组
 * - 输出编译后的 NocoBase filter（旧 {field,op,value} 结构由系统内部自动兼容）
 */
export default function ExportFilterSection({
  state,
  onChange,
}: {
  state: ExportWizardState;
  onChange: (filter: CompiledFilter) => void;
}) {
  const t = useT();
  const ctx = useFlowContext();

  // 获取目标表的 Collection 对象（系统筛选组件需要）
  const collection = useMemo(() => {
    if (!state.collection?.name || state.collection.name === '__all__') return undefined;
    try {
      return ctx.dataSourceManager.getCollection('main', state.collection.name);
    } catch {
      return undefined;
    }
  }, [ctx, state.collection?.name]);

  // 可筛选字段白名单：普通/日期字段（排除关联与附件，与现有行为一致）
  const filterableFieldNames = useMemo(() => {
    const fields = state.meta?.fields || [];
    return fields
      .filter(
        (f) => !f.ignored && !f.attachment && !RELATION_TYPES.includes(f.type) && (DATE_TYPES.includes(f.type) || true),
      )
      .map((f) => f.name);
  }, [state.meta?.fields]);

  if (!collection) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('数据表集合不可用，无法配置筛选条件')} />;
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
        {t('支持「并且/或者」与嵌套分组；字段按类型提供对应操作符与输入控件。')}
      </div>
      <CollectionFilterPanel
        collection={collection}
        initialValue={state.filter}
        filterableFieldNames={filterableFieldNames}
        onChange={onChange}
        t={t}
      />
    </div>
  );
}
