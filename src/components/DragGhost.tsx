import { TaskData } from '../types';
import { COLOR_THEMES } from '../constants';

export const DragGhost = ({ task, position, count }: { task: TaskData | null, position: { x: number; y: number }, count: number }) => {
  if (!task) return null;
  const theme = COLOR_THEMES[task.color] || COLOR_THEMES.blue;
  
  return (
    <div className="fixed pointer-events-none z-[9999]" style={{ left: position.x, top: position.y, transform: 'translate(-20px, -50%) rotate(-2deg) scale(1.02)' }}>
      <div className="bg-white rounded-lg shadow-2xl border border-slate-200 px-4 py-2 min-w-[200px] max-w-[300px] ring-2 ring-blue-400/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${theme.dot}`} />
          <span className="text-sm font-medium text-slate-700 truncate">{task.title || '未命名任務'}</span>
        </div>
        {count > 1 && <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-lg border border-white">{count}</div>}
      </div>
    </div>
  );
};
