
export type TaskStatus = 'inbox' | 'active' | 'waiting' | 'someday' | 'reference' | 'completed' | 'deleted' | 'logged' | 'canceled';
export type SyncStatus = 'synced' | 'syncing' | 'error';
export type TaskColor = 'gray' | 'blue' | 'indigo' | 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'cyan' | 'sky' | 'purple' | 'fuchsia' | 'pink' | 'rose';

// Importance level for tasks (Eisenhower Matrix inspired)
export type ImportanceLevel = 'urgent' | 'planned' | 'delegated' | 'unplanned';

// Repeat/Recurring Task Support
export type RepeatType = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RepeatTriggerMode = 'on_complete' | 'on_schedule'; // on_complete: generate next only when completed; on_schedule: auto-generate when time comes

export interface RepeatRule {
  type: RepeatType;           // daily, weekly, monthly, yearly
  interval: number;           // every N days/weeks/months/years
  weekdays?: number[];        // for weekly: 0=Sun, 1=Mon, ..., 6=Sat
  monthDay?: number;          // for monthly: day of month (1-31)
  yearMonth?: number;         // for yearly: month (1-12)
  yearDay?: number;           // for yearly: day of that month
  endDate?: string;           // optional end date for the recurrence (YYYY-MM-DD)
  endCount?: number;          // optional: stop after N occurrences
  triggerMode?: RepeatTriggerMode; // when to generate next task (default: on_complete)
  originalText?: string;      // original text from Things 3 for reference
  copyDescription?: boolean;  // whether to include description in the next occurrence
}

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
  importance?: ImportanceLevel;  // Importance level: urgent/planned/delegated/unplanned
  created_at: string;
  updated_at?: string;  // Track last modification time
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
  repeat_rule?: RepeatRule | null;  // For recurring tasks
  dependencies?: string[]; // IDs of tasks that must be completed before this one
  reminder_minutes?: number | null; // Minutes before start_date/due_date to remind (null = no reminder)
  is_locked?: boolean; // Whether the task is locked (requires password to view/edit)
  lock_password?: string; // Password hash for locked tasks (cascades to children)
  google_event_id?: string; // ID of the event in Google Calendar
  google_calendar_id?: string; // ID of the calendar in Google Calendar
}

// Reminder/Notification for in-app alerts
export interface Reminder {
  id: string;
  task_id: string;
  task_title: string;
  task_color: TaskColor;
  triggered_at: string; // When this reminder was triggered
  due_time: string; // The original task start_date or due_date
  seen: boolean; // Whether user marked as seen
  snoozed_until?: string | null; // If snoozed, when to remind again
}

// Task Comment for HeartScheduleView interactions
export interface TaskComment {
  id: string;
  task_id: string;
  author_type: 'host' | 'guest';
  author_name?: string;
  content: string;
  created_at: string;
}

// Task Reaction (emoji) for HeartScheduleView interactions
export interface TaskReaction {
  id: string;
  task_id: string;
  emoji: string;
  author_type: 'host' | 'guest';
  created_at: string;
}

export interface AIHistoryEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
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
  anchorTaskIndex: number | null;  // The task the indicator is "attached" to (for date detection)
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
  showRelationshipLines?: boolean;  // Show/hide task relationship lines in Today view
  showImportedGoogleEvents?: boolean;
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
  editingId?: string | null;
  searchOpen?: boolean;
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
