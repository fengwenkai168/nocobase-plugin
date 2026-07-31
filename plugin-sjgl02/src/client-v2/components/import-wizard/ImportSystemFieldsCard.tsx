import React from 'react';
import { Card, Collapse } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useT } from '../../locale';

export default function ImportSystemFieldsCard() {
  const t = useT();
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Collapse
        items={[
          {
            key: 'rules',
            label: (
              <span>
                <SettingOutlined /> {t('NocoBase 系统字段处理逻辑')}
              </span>
            ),
            children: (
              <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                <div>
                  • <strong>createdAt/updatedAt/createdById/updatedById</strong>：
                  {t(
                    '未映射 → 系统自动处理；映射了 Excel 列 → 用 Excel 的值（Excel映射优先）。映射值非法（日期无法解析/用户不存在）→ 该行失败 → 整批回滚。',
                  )}
                </div>
                <div>
                  • <strong>{t('主键字段')}</strong>：
                  {t(
                    '动态发现。自增/自动生成型：未映射自动生成；手动型(string)：必须映射且非空。主键值与库内或本批次重复 → 整批回滚。',
                  )}
                </div>
                <div>
                  • <strong>{t('关联字段')}</strong>：
                  {t(
                    '按目标表主键值关联（多值逗号分隔）。空值处理（保留/解除关联）、匹配不到处理（行失败/跳过该字段）、更新模式（覆盖/追加，仅update/upsert，多对一除外）可在「配置」列按字段设置。',
                  )}
                </div>
                <div>
                  • <strong>{t('附件字段')}</strong>：
                  {t(
                    'Excel填文件名，系统从「配置」列选中的文件夹查找上传。空值处理（保留/删除附件）、匹配不到处理（行失败/跳过该附件）、更新模式（覆盖/追加，仅update/upsert）可按字段设置。',
                  )}
                </div>
                <div>
                  • <strong>{t('子表格/子表单、公式字段')}</strong>：{t('直接忽略，不报错。')}
                </div>
                <div>
                  • <strong>{t('事务模式')}</strong>：{t('严格模式——任何 1 行失败或任务取消，整批全部回滚。')}
                </div>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
