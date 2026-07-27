import { useMemo } from 'react';
import { useFlowContext } from '@nocobase/flow-engine';

export interface TaskRecord {
  id: number;
  type: 'import' | 'export' | string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  title?: string;
  collectionName?: string;
  collectionTitle?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  progressTotal?: number;
  progressCurrent?: number;
  totalRows?: number;
  successRows?: number;
  errorRows?: number;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  message?: string;
  startedAt?: string;
  doneAt?: string;
  duration?: number;
  createdAt?: string;
  createdById?: number;
  createdBy?: { id: number; nickname?: string; username?: string };
  permissionConfigId?: number;
  permissionType?: string;
}

export interface TaskStats {
  total: number;
  succeeded: number;
  running: number;
  pending: number;
  failed: number;
  canceled: number;
}

export interface CollectionOption {
  name: string;
  title: string;
}

export interface FieldMetaInfo {
  name: string;
  title: string;
  type: string;
  interface?: string;
  options?: Array<{ label: string; value: string }>;
  target?: string;
  multiple?: boolean;
  attachment?: boolean;
  ignored?: boolean;
}

export interface CollectionMeta {
  collectionName: string;
  collectionTitle: string;
  pk: { name: string; type: string; auto: boolean };
  fields: FieldMetaInfo[];
}

export interface PermConfigInfo {
  id: number | null;
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  canImport: boolean;
  canExport: boolean;
  importModes: string[];
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
  exportFields: string[];
  exportFilter: unknown;
}

export interface UploadResult {
  filePath: string;
  fileName: string;
  size: number;
  fileKind?: 'xlsx' | 'xls' | 'csv';
  sheets?: Array<{ name: string; rowCount?: number }>;
  rowLimit?: number;
  folders?: Array<{ name: string; fileCount: number }>;
}

export interface PreviewResult {
  headers: string[];
  previewRows: unknown[][];
  totalRows: number;
}

export interface ImportFieldConfig {
  folder?: string;
  emptyStrategy?: 'skip' | 'clear';
  notFound?: 'fail' | 'skip';
  updateMode?: 'overwrite' | 'append';
}

export interface ImportMappingItem {
  field: string;
  source: 'excel' | 'custom' | 'ignore';
  columnIndex?: number;
  columnName?: string;
  value?: string;
  config?: ImportFieldConfig;
  matchRate?: 100 | 80;
}

export function useApi() {
  const ctx = useFlowContext();
  const api = ctx.api;

  return useMemo(() => {
    const unwrap = (payload: { data?: unknown; errors?: Array<{ message?: string }> }) => {
      if (payload?.errors?.length) {
        throw new Error(payload.errors.map((e) => e.message).join('; '));
      }
      return payload?.data;
    };
    const post = async <T = unknown>(url: string, data?: unknown): Promise<T> => {
      const res = await api.request({ url, method: 'post', data });
      return unwrap(res.data) as T;
    };
    const get = async <T = unknown>(url: string, params?: Record<string, unknown>): Promise<T> => {
      const res = await api.request({ url, method: 'get', params });
      return unwrap(res.data) as T;
    };

    return {
      post,
      get,

      async listTasks(params: { page?: number; pageSize?: number; type?: string; status?: string; keyword?: string }) {
        const filter: Record<string, unknown> = {};
        const and: unknown[] = [];
        if (params.type && params.type !== 'all') and.push({ type: params.type });
        if (params.status && params.status !== 'all') and.push({ status: params.status });
        if (params.keyword) {
          and.push({
            $or: [
              { collectionName: { $includes: params.keyword } },
              { collectionTitle: { $includes: params.keyword } },
              { title: { $includes: params.keyword } },
            ],
          });
        }
        if (and.length) filter.$and = and;
        const res = await api.request({
          url: 'sjgl02Tasks:list',
          method: 'get',
          params: {
            page: params.page || 1,
            pageSize: params.pageSize || 20,
            sort: '-id',
            appends: 'createdBy',
            filter,
          },
        });
        return { data: (res.data?.data || []) as TaskRecord[], meta: res.data?.meta || { count: 0 } };
      },

      async getTask(id: number): Promise<TaskRecord> {
        const res = await api.request({
          url: `sjgl02Tasks:get/${id}`,
          method: 'get',
          params: { appends: 'createdBy' },
        });
        return res.data?.data as TaskRecord;
      },

      async getStats(): Promise<TaskStats> {
        const res = await api.request({ url: 'sjgl02Tasks:stats', method: 'get' });
        return res.data?.data as TaskStats;
      },

      async cancelTask(id: number) {
        return api.request({ url: `sjgl02Tasks:cancel/${id}`, method: 'post' });
      },

      async retryTask(id: number): Promise<{ taskId: number }> {
        const res = await api.request({ url: `sjgl02Tasks:retry/${id}`, method: 'post' });
        return res.data?.data as { taskId: number };
      },

      getToken() {
        return (api as unknown as { auth?: { token?: string } }).auth?.token || '';
      },

      downloadUrl(id: number, type: 'result' | 'source' = 'result') {
        return `/api/sjgl02Tasks:download/${id}?type=${type}&token=${encodeURIComponent(this.getToken())}`;
      },

      errorReportUrl(id: number) {
        return `/api/sjgl02Tasks:exportErrorReport/${id}?token=${encodeURIComponent(this.getToken())}`;
      },

      // 浏览器原生直链下载：流式写入磁盘、自带进度，不占内存（大文件适用）
      openDownload(url: string) {
        const link = document.createElement('a');
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
      },

      async downloadFile(url: string, fallbackName = 'download'): Promise<void> {
        const token = (api as unknown as { auth?: { token?: string } }).auth?.token;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`下载失败（${res.status}）：${text.slice(0, 120)}`);
        }
        const disposition = res.headers.get('content-disposition') || '';
        const match = disposition.match(/filename\*=UTF-8''([^;]+)/i) || disposition.match(/filename="?([^";]+)"?/i);
        const fileName = match ? decodeURIComponent(match[1]) : fallbackName;
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      },

      async getImportableCollections(): Promise<{ collections: CollectionOption[] }> {
        return get<{ collections: CollectionOption[] }>('sjgl02:importableCollections');
      },

      async getExportableCollections(): Promise<{ collections: CollectionOption[]; isAdmin: boolean }> {
        return get<{ collections: CollectionOption[]; isAdmin: boolean }>('sjgl02:exportableCollections');
      },

      async getCollectionMeta(collectionName: string): Promise<CollectionMeta> {
        return get<CollectionMeta>('sjgl02:collectionMeta', { collectionName });
      },

      async getImportPermissions(collectionName?: string): Promise<{ permissions: PermConfigInfo[] }> {
        return get<{ permissions: PermConfigInfo[] }>(
          'sjgl02:getImportPermissions',
          collectionName ? { collectionName } : {},
        );
      },

      async getExportPermissions(collectionName?: string): Promise<{ permissions: PermConfigInfo[] }> {
        return get<{ permissions: PermConfigInfo[] }>(
          'sjgl02:getExportPermissions',
          collectionName ? { collectionName } : {},
        );
      },

      async uploadFile(file: File, kind: 'excel' | 'attachment'): Promise<UploadResult> {
        const formData = new FormData();
        formData.append('kind', kind);
        formData.append('file', file);
        const res = await api.request({ url: 'sjgl02:importUpload', method: 'post', data: formData });
        const payload = res.data;
        if (payload?.errors?.length) {
          throw new Error(payload.errors.map((e: { message?: string }) => e.message).join('; '));
        }
        return payload?.data as UploadResult;
      },

      async previewExcel(params: {
        filePath: string;
        fileKind: string;
        sheetName: string;
        headerRow: number;
      }): Promise<PreviewResult> {
        return post<PreviewResult>('sjgl02:previewExcel', params);
      },

      async submitImport(params: Record<string, unknown>): Promise<{ taskId: number; rowCount: number }> {
        return post<{ taskId: number; rowCount: number }>('sjgl02:import', params);
      },

      async submitExport(params: Record<string, unknown>): Promise<{ taskId: number }> {
        return post<{ taskId: number }>('sjgl02:export', params);
      },

      async getPermTargets(): Promise<{
        users: Array<{ id: number; name: string; roles: Array<{ name: string; title?: string }> }>;
        roles: Array<{ name: string; title: string }>;
      }> {
        return get<{
          users: Array<{ id: number; name: string; roles: Array<{ name: string; title?: string }> }>;
          roles: Array<{ name: string; title: string }>;
        }>('sjgl02:permTargets');
      },

      async getPermList(
        targetType: 'user' | 'role',
        targetId: string,
      ): Promise<{
        own: PermRecord[];
        inherited: Array<{ roleName: string; roleTitle: string; items: PermRecord[]; isAdmin: boolean }>;
      }> {
        return get<{
          own: PermRecord[];
          inherited: Array<{ roleName: string; roleTitle: string; items: PermRecord[]; isAdmin: boolean }>;
        }>('sjgl02:permList', { targetType, targetId });
      },

      async createPermission(values: Record<string, unknown>) {
        return post('sjgl02Permissions:create', values);
      },

      async updatePermission(id: number, values: Record<string, unknown>) {
        return post(`sjgl02Permissions:update/${id}`, values);
      },

      async destroyPermission(id: number) {
        return post(`sjgl02Permissions:destroy/${id}`);
      },

      async getPermLogs(params: {
        targetType?: string;
        targetId?: string;
        action?: string;
        page?: number;
        pageSize?: number;
      }) {
        const and: unknown[] = [];
        if (params.targetType) and.push({ targetType: params.targetType });
        if (params.targetId) and.push({ targetId: String(params.targetId) });
        if (params.action && params.action !== 'all') and.push({ action: params.action });
        const res = await api.request({
          url: 'sjgl02PermissionLogs:list',
          method: 'get',
          params: {
            page: params.page || 1,
            pageSize: params.pageSize || 50,
            sort: '-id',
            filter: and.length ? { $and: and } : {},
          },
        });
        return { data: (res.data?.data || []) as PermLogRecord[], meta: res.data?.meta || { count: 0 } };
      },

      async getScope(userId?: number): Promise<{ userId: number; scope: 'self' | 'all' }> {
        return get<{ userId: number; scope: 'self' | 'all' }>('sjgl02Tasks:getScope', userId ? { userId } : {});
      },

      async setScope(userId: number, scope: 'self' | 'all') {
        return post('sjgl02Tasks:setScope', { userId, scope });
      },
    };
  }, [api]);
}

export interface PermRecord {
  id: number;
  targetType: 'user' | 'role';
  targetId: string;
  targetName?: string;
  collectionName: string;
  collectionTitle?: string;
  canImport: boolean;
  canExport: boolean;
  importModes?: string[];
  uniqueFields?: string[];
  requiredFields?: string[];
  importFields?: string[];
  exportFields?: string[];
  exportFilter?: unknown;
  sort?: number;
}

export interface PermLogRecord {
  id: number;
  action: 'create' | 'update' | 'delete' | 'toggle';
  targetType: string;
  targetId: string;
  targetName?: string;
  collectionName: string;
  collectionTitle?: string;
  permissionId?: number;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  summary?: string;
  createdAt?: string;
  createdById?: number;
}
