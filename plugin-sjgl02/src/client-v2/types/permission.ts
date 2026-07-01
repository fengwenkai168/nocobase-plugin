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
  exportFilter: Record<string, unknown> | null;
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
