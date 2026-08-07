import React from 'react';
import { CompiledFilter } from '@nocobase/client-v2';
import { ExportWizardState } from './ExportWizard';
/**
 * 导出筛选条件（复用系统 CollectionFilterPanel）：
 * - 字段树选（Cascader）+ 按字段类型动态操作符 + 专属值控件（日期/枚举/数字等）
 * - 支持 AND/OR 与嵌套分组
 * - 输出编译后的 NocoBase filter（旧 {field,op,value} 结构由系统内部自动兼容）
 */
export default function ExportFilterSection({ state, onChange, }: {
    state: ExportWizardState;
    onChange: (filter: CompiledFilter) => void;
}): React.JSX.Element;
