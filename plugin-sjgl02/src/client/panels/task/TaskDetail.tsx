// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Drawer, Spin, Empty } from 'antd';
import {
  TaskSummaryCard, ExportFieldsCard, RelationTablesCard,
  ImportConfigCard, FieldMappingCard, DataPreviewCard, ExecutionLogCard,
} from './TaskCards';

export function TaskDetail({ api, task, open, onClose, tableTitles }: any) {
  const [detail, setDetail] = useState<any>(null);
  const [fieldTitles, setFieldTitles] = useState<Record<string, string>>({});
  const [assocFieldTitles, setAssocFieldTitles] = useState<Record<string, Record<string, string>>>({});
  const [assocFieldMap, setAssocFieldMap] = useState<Record<string, { fieldName: string; fieldTitle: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!task || !open) return;
    setLoading(true);
    loadDetail(task);
  }, [task?.id, open]);

  const loadDetail = async (t: any) => {
    const d: any = { ...t };
    try {
      const res = await api.request({ url: 'sjgl02Tasks:detail', method: 'get', params: { taskId: t.id } });
      const serverData = res?.data?.data;
      if (serverData) Object.assign(d, serverData);
    } catch {}

    const fileId = d.exportFileId || d.importFileId;
    if (fileId) {
      try {
        const att = await api.request({ url: 'attachments:get', method: 'get', params: { filterByTk: fileId } });
        const a = att?.data?.data || {};
        d._fileName = a.filename || a.title || '';
        d._fileSize = a.size || 0;
        d._fileExt = (a.extname || '').replace('.', '');
      } catch { d._fileName = ''; d._fileSize = 0; d._fileExt = ''; }
    }

    if (d.tableName && d.tableName !== '__all__') {
      try {
        const fd = await api.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: d.tableName } });
        const mainFieldsArr = Array.isArray(fd?.data?.data) ? fd.data.data : [];
        const map: Record<string, string> = {};
        const afMap: Record<string, { fieldName: string; fieldTitle: string }> = {};
        mainFieldsArr.forEach((f: any) => { map[f.name] = f.uiSchema?.title || f.name; });

        const assocTables = Array.isArray(d.associationSheetTables) ? d.associationSheetTables : [];
        const afTitles: Record<string, Record<string, string>> = {};

        for (const assocTable of assocTables) {
          const mainField = mainFieldsArr.find((f: any) => f.name === assocTable);
          if (mainField) {
            afMap[assocTable] = { fieldName: mainField.name, fieldTitle: mainField.uiSchema?.title || mainField.name, targetTable: mainField.target };
          }
          const targetTable = mainField?.target;
          if (targetTable) {
            try {
              const afd = await api.request({ url: 'sjgl02Import:tableFields', method: 'get', params: { tableName: targetTable } });
              const afields = afd?.data?.data || [];
              const tableMap: Record<string, string> = {};
              (Array.isArray(afields) ? afields : []).forEach((f: any) => {
                map[f.name] = f.uiSchema?.title || f.name;
                tableMap[f.name] = f.uiSchema?.title || f.name;
              });
              afTitles[assocTable] = tableMap;
            } catch { afTitles[assocTable] = {}; }
          } else {
            afTitles[assocTable] = {};
          }
        }
        setFieldTitles(map);
        setAssocFieldTitles(afTitles);
        setAssocFieldMap(afMap);
      } catch { setFieldTitles({}); }
    }

    if (Array.isArray(d.customValues)) {
      const cvMap: Record<string, string> = {};
      d.customValues.forEach((cv: any) => {
        if (cv.fieldName && cv.value) cvMap[cv.fieldName] = String(cv.value);
      });
      d.customValues = cvMap;
    }
    if (!d.customValues || Array.isArray(d.customValues)) d.customValues = d.customValues || {};

    setDetail(d);
    setLoading(false);
  };

  if (!open) return null;

  return (
    <Drawer title={detail ? `任务 #${detail.id}` : '任务详情'} open={open} onClose={onClose} width={1024} destroyOnClose>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : detail ? (
        <div>
          <TaskSummaryCard task={detail} api={api} tableTitles={tableTitles} fieldTitles={fieldTitles} />
          {detail.taskType === 'export' && <ExportFieldsCard task={detail} fieldTitles={fieldTitles} tableTitles={tableTitles} assocFieldTitles={assocFieldTitles} assocFieldMap={assocFieldMap} />}
          <RelationTablesCard task={detail} tableTitles={tableTitles} assocFieldMap={assocFieldMap} api={api} />
          {detail.taskType === 'import' && <ImportConfigCard task={detail} fieldTitles={fieldTitles} />}
          {detail.taskType === 'import' && <FieldMappingCard task={detail} fieldTitles={fieldTitles} />}
          {detail.tableName !== '__all__' && <DataPreviewCard task={detail} api={api} fieldTitles={fieldTitles} />}
          <ExecutionLogCard task={detail} api={api} />
        </div>
      ) : (
        <Empty description="加载失败" />
      )}
    </Drawer>
  );
}
