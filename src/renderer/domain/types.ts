export type Priority = 0 | 1 | 2 | 3;

export type RepeatType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'workday' | 'lunar';

export interface RepeatRule {
  type: RepeatType;
  interval: number;
}

export interface SubTask {
  id: string;
  title: string;
  isDone: boolean;
}

export interface Task {
  id: string;
  title: string;
  content?: string;
  listId: string;
  isDone: boolean;
  dueDate?: number | null;
  startDate?: number | null;
  tags: string[];
  subTasks: SubTask[];
  createdAt: number;
  updatedAt: number;
  priority: Priority;
  important?: boolean;
  urgentOverride?: boolean | null;
  sortOrder?: number;
  blockedBy?: string[];
  repeatRule?: RepeatRule;
  ebbinghaus?: boolean;
  ebbinghausStage?: number;
  notified?: boolean;
}

export interface TaskList {
  id: string;
  label: string;
  color: string;
}

export interface CustomTag {
  id: string;
  label: string;
}

export type ActiveMenu = 'inbox' | 'today' | 'next7days' | `list-${string}` | `tag-${string}`;

export type ViewMode = 'list' | 'kanban' | 'calendar' | 'timeline' | 'matrix';

export type MatrixQuadrant = 'important-urgent' | 'important-not-urgent' | 'not-important-urgent' | 'not-important-not-urgent';
