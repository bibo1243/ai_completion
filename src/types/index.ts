
export type TaskStatus = 'inbox' | 'active' | 'waiting' | 'someday' | 'reference' | 'completed' | 'deleted' | 'logged';
export type SyncStatus = 'synced' | 'syncing' | 'error';
export type TaskColor = 'gray' | 'blue' | 'indigo' | 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'cyan' | 'sky' | 'purple' | 'fuchsia' | 'pink' | 'rose';

export interface TagData {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  color: string;
  order_index?: number;
}

export interface TaskData {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  parent_id: string | null;
  start_date: string | null;
  due_date: string | null;
  is_project: boolean;
  tags: string[];
  color: TaskColor;
  created_at: string;
  completed_at: string | null;
  order_index: number;
  images?: string[];
}

export interface FlatTask {
  data: TaskData;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  path: string[];
  index: number;
  breadcrumbs?: TaskData[];
}

export interface DragState {
  isDragging: boolean;
  draggedId: string | null;
  originalDepth: number;
  dragOffsetX: number;
  dropIndex: number | null;
  dropDepth: number;
  indicatorTop: number;
  indicatorLeft: number;
  indicatorWidth: number;
  ghostPosition: { x: number; y: number };
}

export type HistoryActionType = 'ADD' | 'DELETE' | 'UPDATE' | 'BATCH_UPDATE' | 'ADD_TAG' | 'DELETE_TAG' | 'UPDATE_TAG';

export interface BatchUpdateRecord {
    id: string;
    before: Partial<TaskData>;
    after: Partial<TaskData>;
}

export interface HistoryRecord {
  type: HistoryActionType;
  payload: any;
}

export interface ThemeSettings {
    fontWeight: 'normal' | 'thin';
    fontSize: 'small' | 'normal' | 'large';
}

export type AIProvider = 'gemini' | 'openai';

export interface AISettings {
    provider: AIProvider;
    apiKey: string;
    baseUrl?: string;
    modelName?: string;
}

export interface NavRecord {
  view: string;
  focusedId: string | null;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  preferences: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    startOfWeek?: 'sunday' | 'monday';
  };
  updated_at: string;
}
