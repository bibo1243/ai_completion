
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

export interface AttachmentLink {
  paragraphId: string;
  attachmentUrls: string[];
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
  view_orders?: Record<string, number>;
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  duration: number | null;
  images?: string[];
  attachments?: Array<{ name: string; url: string; size: number; type: string }>;
  attachment_links?: AttachmentLink[];
  ai_history?: AIHistoryEntry[];
  reviewed_at: string | null;
}

export interface AIHistoryEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  model?: string;
  prompt?: string; // If role is assistant, what was the prompt?
}

export interface ArchivedTaskData extends TaskData {
  original_parent_id: string | null;
  archived_at: string;
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

export type HistoryActionType = 'ADD' | 'DELETE' | 'UPDATE' | 'BATCH_UPDATE' | 'ADD_TAG' | 'DELETE_TAG' | 'UPDATE_TAG' | 'ARCHIVE' | 'BATCH_DELETE';

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
  fontFamily: 'system' | 'things' | 'serif' | 'mono' | 'rounded';
  timeFormat?: '12h' | '24h';
  showLunar?: boolean;
  showTaiwanHolidays?: boolean;
  language?: 'zh' | 'en';
  themeMode?: 'light' | 'dark' | 'programmer';
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

export interface SearchFilters {
  tags: string[];
  startDate: string | null;
  endDate: string | null;
  colors: string[];
}

export interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  filters: SearchFilters;
  name: string | null;
  created_at: string;
  updated_at: string;
}
