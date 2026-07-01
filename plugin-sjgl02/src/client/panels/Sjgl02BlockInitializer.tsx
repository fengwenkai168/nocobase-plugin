import React from 'react';
import { DatabaseOutlined } from '@ant-design/icons';
import { SchemaInitializerItem, useSchemaInitializer, useSchemaInitializerItem } from '@nocobase/client';

export const Sjgl02BlockInitializer = () => {
  const { insert } = useSchemaInitializer();
  const itemConfig = useSchemaInitializerItem();

  return (
    <SchemaInitializerItem
      {...itemConfig}
      icon={<DatabaseOutlined />}
      onClick={() => {
        insert({
          type: 'void',
          'x-settings': 'blockSettings:sjgl02',
          'x-component': 'SjglBlock',
          'x-decorator': 'CardItem',
          'x-decorator-props': {
            name: 'sjgl02',
          },
        });
      }}
    />
  );
};
