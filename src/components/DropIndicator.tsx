import { TaskColor } from '../types';
import { COLOR_THEMES } from '../constants';

export const DropIndicator = ({ show, top, left, width, color }: { show: boolean; top: number; left: number; width: number; depth: number; color: TaskColor; }) => {
  if (!show) return null;
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  return (
    <div className="absolute pointer-events-none z-40 transition-all duration-100 ease-out" style={{ top: `${top}px`, left: `${left}px`, width: `${width}px` }}>
      <div className={`h-0.5 ${theme.indicator} rounded-full shadow-sm relative`}>
        <div className={`absolute -left-1.5 -top-[3px] w-2 h-2 ${theme.indicator} rounded-full shadow-md`} />
      </div>
    </div>
  );
};
