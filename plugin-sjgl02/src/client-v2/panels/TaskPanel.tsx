// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useAPI } from '../utils/api';
import { TaskList } from './task/TaskList';
import { TaskDetail } from './task/TaskDetail';

export default function TaskPanel() {
  const api = useAPI();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tableTitles, setTableTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    api.request({ url: 'sjgl02Permissions:tables', method: 'get' }).then((res: any) => {
      const data = res?.data?.data || [];
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        data.forEach((t: any) => { map[t.name] = t.title || t.name; });
        setTableTitles(map);
      }
    }).catch(() => {});
  }, []);

  const handleView = (task: any) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  return (
    <div>
      <TaskList api={api} onViewTask={handleView} />
      <TaskDetail
        api={api}
        task={selectedTask}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tableTitles={tableTitles}
      />
    </div>
  );
}
