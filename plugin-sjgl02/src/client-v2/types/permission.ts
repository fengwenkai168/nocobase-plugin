export interface Permission {
  id?: number;
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  tableName: string;
  canImport: boolean;
  canExport: boolean;
  importMode: string[];
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
  exportFields: string[];
  _inherited?: boolean;
  _systemManaged?: boolean;
}

export interface Target {
  id: string;
  nickname: string;
  name?: string;
  title?: string;
  type: 'user' | 'role';
  roles?: Array<{ name: string; title: string }>;
}

export interface TableInfo {
  name: string;
  title: string;
}

export interface FieldInfo {
  name: string;
  label: string;
  type?: string;
  interface?: string;
  uiSchema?: { title?: string; enum?: any[] };
  isAssociation?: boolean;
}

export interface PermissionFormValues {
  tableName: string;
  canImport: boolean;
  canExport: boolean;
  importMode: string[];
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
  exportFields: string[];
}
