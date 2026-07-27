/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ModelConstructor } from '@nocobase/flow-engine';
import { Sjgl02BlockModel } from '../../client-v2/models/Sjgl02BlockModel';

// v1 运行时（/admin 路径）也需要认识该区块模型：
// v2 页面（flowPage）在 v1 运行时内嵌渲染时，依赖此注册才能正常显示/添加 sjgl02 区块
export default { Sjgl02BlockModel } as Record<string, ModelConstructor>;
