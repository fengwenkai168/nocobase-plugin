import React, { useState, useEffect } from 'react';
import { useAPI } from '../utils/api';
import { TaskList } from './task/TaskList';
import { TaskDetail } from './task/TaskDetail';

interface TableInfo {
  name: string;
  title: string;
}

export default function TaskPanel() {
  const api = useAPI();
  const [selectedTask, setSelectedTask] = useState<Record<string, unknown> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tableTitles, setTableTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .request({ url: 'sjgl02Permissions:tables', method: 'get' })
      .then((res: unknown) => {
        const data = (res as { data?: { data?: TableInfo[] } })?.data?.data || [];
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((t: TableInfo) => {
            map[t.name] = t.title || t.name;
          });
          setTableTitles(map);
        }
      })
      .catch(() => {});
  }, [api]);

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
