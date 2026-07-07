/** 字段元数据（scalar / relation / attachment） */
export interface FieldMeta {
  name: string;
  type: string;
  isScalar: boolean;
  isRelation: boolean;
  isAttachment: boolean;
  target?: string;
  foreignKey?: string;
  otherKey?: string;
  through?: string;
  interface?: string;
}

/** 关联表 sheet 配置 */
export interface AssociationSheetConfig {
  fieldName: string;
  targetTable: string;
  displayName: string;
  targetFields: string[];
  targetFieldHeaders: Record<string, string>;
}

/** 单张表的导出配置（__all__ 多表导出时使用） */
export interface TableConfig {
  tableName: string;
  fieldNames: string[];
  fieldHeaders: Record<string, string>;
  collDisplayName: string;
  pkStrategy: 'cursor' | 'uuid' | 'offset';
  pkField: string | null;
  collectionTotal: number;
}

/** IPC 消息类型：主进程 → 子进程 */
export interface StartMessage {
  type: 'start';
  taskId: number;
  tableName: string;
  fieldNames: string[];
  selectedFields?: string[];
  filter?: Record<string, any>;
  headerStyle?: string;
  pkStrategy: 'cursor' | 'uuid' | 'offset';
  pkField: string | null;
  collectionTotal: number;
  includeAttachments?: boolean;
  attachmentFieldNames?: string[];
  fileIdFieldNames?: string[];
  fieldMetas?: FieldMeta[];
  includeAssociationSheet?: boolean;
  associationSheetTables?: string[];
  associationSheets?: AssociationSheetConfig[];
  /** 字段显示名映射（用于 Excel 表头） */
  fieldHeaders: Record<string, string>;
  /** 表显示名 */
  collDisplayName: string;
  /** 临时文件输出目录 */
  tempDir: string;
  /** 文件名模板 */
  fileNameTemplate?: string;
  /** __all__ 多表导出时的表配置列表 */
  tableList?: TableConfig[];
}

export interface CancelMessage {
  type: 'cancel';
}

/** IPC 消息类型：子进程 → 主进程 */
export interface ProgressMessage {
  type: 'progress';
  processedRows: number;
  totalRows: number;
  progress: number;
}

export interface LogMessage {
  type: 'log';
  level: string;
  message: string;
}

export interface CompletedMessage {
  type: 'completed';
  filePath: string;
  fileSize: number;
  processedRows: number;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  stack?: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  ts: number;
}

/** 子进程发出的所有消息类型 */
export type WorkerMessage = ProgressMessage | LogMessage | CompletedMessage | ErrorMessage | HeartbeatMessage;

/** 主进程发给子进程的所有消息类型 */
export type ParentMessage = StartMessage | CancelMessage;

/** 导出参数（从 executeExport action 提取到子进程） */
export interface ExportParams {
  jobId: string;
  taskId: number;
  tableName: string;
  fieldNames: string[];
  filter: Record<string, any>;
  headerStyle: string;
  pkStrategy: 'cursor' | 'uuid' | 'offset';
  pkField: string | null;
  collectionTotal: number;
  includeAttachments: boolean;
  attachmentFieldNames: string[];
  fileIdFieldNames: string[];
  fieldHeaders: Record<string, string>;
  collDisplayName: string;
  totalRows: number;
}
