import React from 'react';
import { FieldMetaInfo, PermConfigInfo } from '../../services/api';
export default function ImportPermissionSummary({ permission, fields, }: {
    permission: PermConfigInfo;
    fields: FieldMetaInfo[];
}): React.JSX.Element;
