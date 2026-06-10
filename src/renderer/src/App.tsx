import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as chrono from 'chrono-node';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfDay,
  startOfWeek
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import localforage from 'localforage';
import {
  Archive,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Flag,
  Folder,
  Grid3X3,
  Inbox,
  KanbanSquare,
  LayoutList,
  Lock,
  MicOff,
  MoreHorizontal,
  Pause,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  Pin,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Tag,
  Timer,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { Solar } from 'lunar-javascript';
import {
  collapsedSidebarStyles,
  getSidebarButtonClass,
  getSidebarSectionClass,
  shouldRenderSidebarBrand
} from './sidebar-styles';
import {
  getDetailDateLabel,
  getPriorityDetailLabel,
  getRepeatDetailLabel
} from '../domain/task-display';
import {
  CUSTOM_TAGS_KEY,
  DEFAULT_TAGS,
  INITIAL_LISTS,
  LISTS_KEY,
  TASKS_KEY,
  createId,
  exportToObsidian,
  filterTasks,
  getMatrixPatchForQuadrant,
  getMatrixQuadrant,
  getNextSelectedTaskId,
  getTagLabel,
  getVisibleTasksForMenu,
  importFromObsidian,
  isTaskBlocked,
  mergeTags,
  toggleTaskDone
} from '../domain/task-model';
import type { ActiveMenu, CustomTag, MatrixQuadrant, Priority, RepeatRule, Task, TaskList, ViewMode } from '../domain/types';
import iconUrl from '../../../resources/icon.png';

localforage.config({
  name: 'ticktick-clone',
  version: 1,
  storeName: 'tasks',
  description: 'Local storage for tasks and user data'
});

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const viewItems: Array<{ id: ViewMode; title: string; icon: typeof LayoutList }> = [
  { id: 'list', title: '列表视图', icon: LayoutList },
  { id: 'kanban', title: '看板视图', icon: KanbanSquare },
  { id: 'calendar', title: '日历视图', icon: CalendarDays },
  { id: 'timeline', title: '时间线视图', icon: MoreHorizontal },
  { id: 'matrix', title: '四象限视图', icon: Grid3X3 }
];

const priorityLabels = ['无优先级', '低优先级', '中优先级', '高优先级'];
const priorityShortLabels = ['', '低', '中', '高'];
const priorityColors = ['text-slate-300', 'text-blue-500', 'text-orange-500', 'text-red-500'];
const priorityDotColors = ['bg-slate-300', 'bg-blue-500', 'bg-orange-500', 'bg-red-500'];
const priorityFlagColors = ['text-slate-300', 'text-blue-500', 'text-orange-500', 'text-red-500'];
const tagTextColors = ['text-blue-500', 'text-green-500', 'text-red-500', 'text-yellow-500', 'text-purple-500', 'text-pink-500', 'text-indigo-500', 'text-teal-500'];
const tagBgColors = ['bg-blue-100', 'bg-green-100', 'bg-red-100', 'bg-yellow-100', 'bg-purple-100', 'bg-pink-100', 'bg-indigo-100', 'bg-teal-100'];
const matrixQuadrantIds: MatrixQuadrant[] = ['important-urgent', 'important-not-urgent', 'not-important-urgent', 'not-important-not-urgent'];
const matrixQuadrantMeta: Record<MatrixQuadrant, { title: string; hint: string; action: string; dot: string; badge: string; taskDate: string }> = {
  'important-urgent': { title: '重要且紧急', hint: '立即处理', action: 'DO FIRST', dot: 'bg-red-500', badge: 'bg-red-50 text-red-500', taskDate: 'text-red-500' },
  'important-not-urgent': { title: '重要不紧急', hint: '计划安排', action: 'SCHEDULE', dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-600', taskDate: 'text-slate-500' },
  'not-important-urgent': { title: '紧急不重要', hint: '尽快完成', action: 'DELEGATE', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-500', taskDate: 'text-slate-500' },
  'not-important-not-urgent': { title: '不重要不紧急', hint: '稍后处理', action: 'ELIMINATE', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', taskDate: 'text-slate-500' }
};

function isMatrixQuadrantId(value: unknown): value is MatrixQuadrant {
  return typeof value === 'string' && matrixQuadrantIds.includes(value as MatrixQuadrant);
}

function getTagColor(tag: string): { text: string; bg: string } {
  if (tag === 'urgent') return { text: 'text-yellow-500', bg: 'bg-yellow-100' };
  if (tag === 'reading') return { text: 'text-orange-500', bg: 'bg-orange-100' };
  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) hash = tag.charCodeAt(index) + ((hash << 5) - hash);
  const colorIndex = Math.abs(hash) % tagTextColors.length;
  return { text: tagTextColors[colorIndex], bg: tagBgColors[colorIndex] };
}

function getCalendarNote(date: Date): string {
  const lunar = Solar.fromDate(date).getLunar();
  return lunar.getFestivals()[0] || lunar.getJieQi() || '';
}

function formatDate(value?: number | null): string {
  if (!value) return '无日期';
  if (isToday(value)) return '今天';
  return format(value, 'M月d日', { locale: zhCN });
}

function formatCompactDate(value?: number | null): string {
  if (!value) return '无日期';
  if (isToday(value)) return '今天';
  return format(value, 'yyyy/M/d', { locale: zhCN });
}

function formatMonthDay(value?: number | null): string {
  if (!value) return '无日期';
  if (isToday(value)) return '今天';
  return format(value, 'M月d日', { locale: zhCN });
}

function dateInputValue(value?: number | null): string {
  if (!value) return '';
  return format(value, 'yyyy-MM-dd');
}

function getActiveLabel(activeMenu: ActiveMenu, lists: TaskList[], tags: CustomTag[]): string {
  if (activeMenu === 'inbox') return '未分类';
  if (activeMenu === 'today') return '今天';
  if (activeMenu === 'next7days') return '最近7天';
  if (activeMenu.startsWith('list-')) return lists.find((list) => list.id === activeMenu)?.label || '清单';
  const tagId = activeMenu.replace('tag-', '');
  return tags.find((tag) => tag.id === tagId)?.label || getTagLabel(tagId);
}

function parseQuickTaskTitle(rawTitle: string, fallbackListId: string): { title: string; dueDate: number | null; tags: string[]; listId: string } {
  let title = rawTitle.trim();
  const tags: string[] = [];
  title = title.replace(/#([\w\u4e00-\u9fa5-]+)/g, (_, tag: string) => {
    tags.push(tag);
    return '';
  });
  const parsedDate = chrono.zh.parseDate(title, new Date(), { forwardDate: true });
  let dueDate: number | null = null;
  if (parsedDate) {
    parsedDate.setSeconds(0, 0);
    dueDate = parsedDate.getTime();
    const dateTerms = ['今天', '明天', '后天', '下午', '上午', '晚上', '下周', '周末', '点', '号', '月'];
    for (const term of dateTerms) title = title.replace(term, '');
  }
  return {
    title: title.replace(/\s+/g, ' ').trim() || rawTitle.trim(),
    dueDate,
    tags,
    listId: fallbackListId
  };
}

export default function App(): React.ReactElement {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>(INITIAL_LISTS);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('inbox');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);

  const availableTags = useMemo(() => mergeTags(DEFAULT_TAGS, customTags), [customTags]);
  const activeLabel = getActiveLabel(activeMenu, lists, availableTags);

  useEffect(() => {
    let cancelled = false;
    async function loadData(): Promise<void> {
      const storedTasks = await localforage.getItem<Task[]>(TASKS_KEY);
      const storedLists = await localforage.getItem<TaskList[]>(LISTS_KEY);
      const storedTags = await localforage.getItem<CustomTag[]>(CUSTOM_TAGS_KEY);
      if (cancelled) return;
      setTasks(storedTasks || []);
      setLists(storedLists && storedLists.length > 0 ? storedLists : INITIAL_LISTS);
      setCustomTags(storedTags || []);
      setIsLoading(false);
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) localforage.setItem(TASKS_KEY, tasks);
  }, [tasks, isLoading]);

  useEffect(() => {
    if (!isLoading) localforage.setItem(LISTS_KEY, lists);
  }, [lists, isLoading]);

  useEffect(() => {
    if (!isLoading) localforage.setItem(CUSTOM_TAGS_KEY, customTags);
  }, [customTags, isLoading]);

  useEffect(() => {
    const off = window.electron?.ipcRenderer.on('focus-quick-add', () => setIsQuickAddOpen(true));
    return () => off?.();
  }, []);

  const filteredTasks = useMemo(() => getVisibleTasksForMenu(tasks, activeMenu), [tasks, activeMenu]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;

  const selectTask = useCallback((id: string) => {
    setSelectedTaskId((current) => getNextSelectedTaskId(current, id));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch, updatedAt: Date.now() } : task)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
    setSelectedTaskId((current) => (current === id ? null : current));
  }, []);

  const addTask = useCallback(
    (title: string, options: Partial<Task> = {}) => {
      const now = Date.now();
      const fallbackListId = activeMenu.startsWith('list-') ? activeMenu : 'inbox';
      const parsed = parseQuickTaskTitle(title, fallbackListId);
      const task: Task = {
        id: createId(),
        title: parsed.title,
        content: '',
        listId: options.listId || parsed.listId,
        isDone: false,
        dueDate: options.dueDate ?? parsed.dueDate ?? (activeMenu === 'today' ? new Date().setHours(12, 0, 0, 0) : null),
        tags: options.tags ? Array.from(new Set([...parsed.tags, ...options.tags])) : parsed.tags,
        subTasks: [],
        createdAt: now,
        updatedAt: now,
        priority: (options.priority as Priority | undefined) ?? 0
      };
      setTasks((current) => [task, ...current]);
      return task;
    },
    [activeMenu]
  );

  const toggleDone = useCallback((id: string) => {
    setTasks((current) => {
      const result = toggleTaskDone(current, id);
      return result.changed ? result.tasks : current;
    });
  }, []);

  const reorderTasks = useCallback((activeId: string, overId: string) => {
    setTasks((current) => {
      const oldIndex = current.findIndex((task) => task.id === activeId);
      const newIndex = current.findIndex((task) => task.id === overId);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, []);

  const addList = (label: string): void => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setLists((current) => [...current, { id: `list-${createId('list').slice(0, 8)}`, label: trimmed, color: 'bg-slate-400' }]);
  };

  const addTag = (label: string): void => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = trimmed.replace(/^#/, '');
    setCustomTags((current) => [...current, { id, label: getTagLabel(id) }]);
  };

  const taskApi = { tasks, lists, availableTags, addTask, updateTask, deleteTask, toggleDone, reorderTasks, setTasks };

  return (
    <div className="h-screen overflow-hidden bg-white text-text-main font-body">
      <div className="flex h-full">
        <Sidebar
          tasks={tasks}
          lists={lists}
          tags={availableTags}
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          onSettings={() => setIsSettingsOpen(true)}
          onAddList={addList}
          onDeleteList={(id) => setLists((current) => current.filter((list) => list.id !== id))}
          onAddTag={addTag}
          onDeleteTag={(id) => setCustomTags((current) => current.filter((tag) => tag.id !== id))}
        />
        <main className="flex flex-1 min-w-0 flex-col bg-slate-50">
          <Header
            viewMode={viewMode}
            setViewMode={setViewMode}
            onSearch={() => setIsSearchOpen(true)}
            onQuickAdd={() => setIsQuickAddOpen(true)}
            showPomodoro={showPomodoro}
            setShowPomodoro={setShowPomodoro}
          />
          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            <section className="flex flex-1 min-w-0 overflow-hidden">
              {isLoading ? (
                <CenteredState text="正在加载任务..." />
              ) : (
                <>
                  {viewMode === 'list' && <TaskListView tasks={filteredTasks} activeLabel={activeLabel} activeMenu={activeMenu} taskApi={taskApi} onSelectTask={selectTask} />}
                  {viewMode === 'kanban' && <KanbanView tasks={filteredTasks} taskApi={taskApi} onSelectTask={selectTask} />}
                  {viewMode === 'calendar' && <CalendarView tasks={filteredTasks} onSelectTask={selectTask} />}
                  {viewMode === 'timeline' && <TimelineView tasks={filteredTasks} taskApi={taskApi} onSelectTask={selectTask} />}
                  {viewMode === 'matrix' && <MatrixView tasks={filteredTasks} taskApi={taskApi} onSelectTask={selectTask} />}
                </>
              )}
            </section>
            <AnimatePresence>
              {selectedTask && <TaskDetail task={selectedTask} taskApi={taskApi} onClose={() => setSelectedTaskId(null)} onSelectTask={selectTask} />}
            </AnimatePresence>
          </div>
        </main>
      </div>
      <AnimatePresence>{showPomodoro && <PomodoroTimer onClose={() => setShowPomodoro(false)} />}</AnimatePresence>
      <AnimatePresence>{isQuickAddOpen && <QuickAddModal taskApi={taskApi} onClose={() => setIsQuickAddOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{isSearchOpen && <SearchModal tasks={tasks} lists={lists} onSelectTask={selectTask} onClose={() => setIsSearchOpen(false)} />}</AnimatePresence>
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsDialog
            tasks={tasks}
            setTasks={setTasks}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface TaskApi {
  tasks: Task[];
  lists: TaskList[];
  availableTags: CustomTag[];
  addTask: (title: string, options?: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleDone: (id: string) => void;
  reorderTasks: (activeId: string, overId: string) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

function Sidebar(props: {
  tasks: Task[];
  lists: TaskList[];
  tags: CustomTag[];
  activeMenu: ActiveMenu;
  setActiveMenu: (menu: ActiveMenu) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onSettings: () => void;
  onAddList: (label: string) => void;
  onDeleteList: (id: string) => void;
  onAddTag: (label: string) => void;
  onDeleteTag: (id: string) => void;
}): React.ReactElement {
  const [listDraft, setListDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [isAddingList, setIsAddingList] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const nav = [
    { id: 'inbox' as ActiveMenu, label: '未分类', icon: Inbox, color: 'text-slate-600' },
    { id: 'today' as ActiveMenu, label: '今天', icon: Calendar, color: 'text-blue-500' },
    { id: 'next7days' as ActiveMenu, label: '最近7天', icon: CalendarDays, color: 'text-purple-500' }
  ];
  const countFor = (menu: ActiveMenu) => filterTasks(props.tasks, menu).length;
  const renderBrand = shouldRenderSidebarBrand(props.isCollapsed);

  return (
    <aside className={cn('glass-sidebar group/sidebar relative z-20 flex h-full flex-col border-r border-slate-200/80 bg-slate-100/70 py-4 transition-all', props.isCollapsed ? collapsedSidebarStyles.aside : 'w-[220px]')}>
      {renderBrand ? (
        <div className="mb-5 flex items-center gap-3 px-4" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <img src={iconUrl} className="h-7 w-7 rounded-[4px]" alt="" />
          <div className="text-xl font-bold tracking-normal">DoneBox</div>
          <button
            className="ml-auto rounded-[8px] p-1.5 text-slate-500 opacity-0 transition-opacity hover:bg-slate-200 group-hover/sidebar:opacity-100"
            title="收起侧边栏"
            onClick={() => props.setIsCollapsed(true)}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          className={collapsedSidebarStyles.toggleButton}
          title="展开侧边栏"
          onClick={() => props.setIsCollapsed(false)}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}
      <nav className={cn('flex-1 overflow-y-auto', props.isCollapsed ? collapsedSidebarStyles.nav : 'px-2')}>
        {nav.map((item) => (
          <SidebarButton key={item.id} active={props.activeMenu === item.id} collapsed={props.isCollapsed} icon={item.icon} color={item.color} label={item.label} count={countFor(item.id)} onClick={() => props.setActiveMenu(item.id)} />
        ))}
        <SidebarSection title="清单" collapsed={props.isCollapsed} onAdd={() => setIsAddingList(true)}>
          {props.lists.map((list) => (
            <SidebarButton
              key={list.id}
              active={props.activeMenu === list.id}
              collapsed={props.isCollapsed}
              dot={list.color}
              label={list.label}
              count={countFor(list.id as ActiveMenu)}
              onClick={() => props.setActiveMenu(list.id as ActiveMenu)}
              onDelete={() => props.onDeleteList(list.id)}
              deleteTitle="删除清单"
            />
          ))}
          {!props.isCollapsed && isAddingList && (
            <InlineCreate value={listDraft} placeholder="新建清单" onChange={setListDraft} onSubmit={() => { props.onAddList(listDraft); setListDraft(''); setIsAddingList(false); }} />
          )}
        </SidebarSection>
        <SidebarSection title="标签" collapsed={props.isCollapsed} onAdd={() => setIsAddingTag(true)}>
          {props.tags.map((tag) => {
            const color = getTagColor(tag.id);
            return (
              <SidebarButton
                key={tag.id}
                active={props.activeMenu === `tag-${tag.id}`}
                collapsed={props.isCollapsed}
                icon={Tag}
                color={color.text}
                label={tag.label}
                count={countFor(`tag-${tag.id}` as ActiveMenu)}
                onClick={() => props.setActiveMenu(`tag-${tag.id}` as ActiveMenu)}
                onDelete={DEFAULT_TAGS.includes(tag.id) ? undefined : () => props.onDeleteTag(tag.id)}
                deleteTitle="删除标签"
              />
            );
          })}
          {!props.isCollapsed && isAddingTag && (
            <InlineCreate value={tagDraft} placeholder="新建标签" onChange={setTagDraft} onSubmit={() => { props.onAddTag(tagDraft); setTagDraft(''); setIsAddingTag(false); }} />
          )}
        </SidebarSection>
      </nav>
      <button className={cn(props.isCollapsed ? collapsedSidebarStyles.settingsButton : 'mx-2 flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-800')} onClick={props.onSettings} title={props.isCollapsed ? '设置' : undefined}>
        <Settings className="h-[1.125rem] w-[1.125rem]" />
        {!props.isCollapsed && <span className="text-[15px] font-medium">设置</span>}
      </button>
    </aside>
  );
}

function SidebarSection({ title, collapsed, onAdd, children }: { title: string; collapsed: boolean; onAdd?: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={getSidebarSectionClass(collapsed)}>
      {!collapsed && (
        <div className="mb-2 flex items-center justify-between px-2 text-[13px] font-semibold text-slate-400">
          <span>{title}</span>
          {onAdd && (
            <button className="rounded p-0.5 opacity-0 hover:bg-slate-200 group-hover:opacity-100" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function SidebarButton(props: {
  active: boolean;
  collapsed: boolean;
  label: string;
  count?: number;
  icon?: typeof Inbox;
  dot?: string;
  color?: string;
  onClick: () => void;
  onDelete?: () => void;
  deleteTitle?: string;
}): React.ReactElement {
  const Icon = props.icon;
  return (
    <button
      className={getSidebarButtonClass(props.collapsed, props.active)}
      onClick={props.onClick}
      title={props.collapsed ? props.label : undefined}
    >
      {Icon && <Icon className={cn('h-[1.05rem] w-[1.05rem]', props.active ? 'text-white' : props.color)} />}
      {props.dot && <span className={cn('h-2 w-2 rounded-full', props.active ? 'bg-white' : props.dot)} />}
      {!props.collapsed && <span className="min-w-0 flex-1 truncate font-medium">{props.label}</span>}
      {!props.collapsed && props.count ? <span className={cn('text-xs', props.active ? 'text-white/90' : 'text-slate-400')}>{props.count}</span> : null}
      {!props.collapsed && props.onDelete && (
        <span
          role="button"
          title={props.deleteTitle}
          className={cn('rounded p-1 opacity-0 transition-opacity group-hover:opacity-100', props.active ? 'hover:bg-white/20' : 'hover:bg-slate-300/70')}
          onClick={(event) => {
            event.stopPropagation();
            props.onDelete?.();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

function InlineCreate({ value, placeholder, onChange, onSubmit }: { value: string; placeholder: string; onChange: (value: string) => void; onSubmit: () => void }): React.ReactElement {
  return (
    <div className="mt-1 flex h-8 items-center rounded-[8px] px-2 text-slate-400 hover:bg-slate-200/50">
      <Plus className="mr-2 h-3.5 w-3.5" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        placeholder={placeholder}
      />
    </div>
  );
}

function Header(props: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onSearch: () => void;
  onQuickAdd: () => void;
  showPomodoro: boolean;
  setShowPomodoro: (show: boolean) => void;
}): React.ReactElement {
  return (
    <header className="relative z-30 flex flex-shrink-0 items-center justify-between bg-white/80 px-5 py-2.5" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-1 rounded-[8px] bg-slate-100/80 p-1 shadow-sm" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {viewItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} title={item.title} className={cn('flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-500 transition-colors hover:text-slate-800', props.viewMode === item.id && 'bg-white text-blue-500 shadow-sm')} onClick={() => props.setViewMode(item.id)}>
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="flex h-9 items-center gap-2 rounded-[8px] border border-slate-200 bg-white/90 px-3 text-sm text-slate-400 shadow-sm" onClick={props.onSearch}>
          <Search className="h-4 w-4" />
          <span>搜索...</span>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-400">⌘K</kbd>
        </button>
        <div className="h-6 w-px bg-slate-200" />
        <button title="番茄钟" className={cn('flex h-9 w-9 items-center justify-center rounded-[8px] text-slate-500 hover:bg-slate-100', props.showPomodoro && 'bg-blue-50 text-blue-500 ring-1 ring-yellow-400')} onClick={() => props.setShowPomodoro(!props.showPomodoro)}>
          <Timer className="h-5 w-5" />
        </button>
        <button className="flex h-9 items-center gap-2 rounded-[8px] bg-blue-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-600" onClick={props.onQuickAdd}>
          <Plus className="h-4 w-4" />
          新建
        </button>
      </div>
    </header>
  );
}

function TaskListView({ tasks, activeLabel, activeMenu, taskApi, onSelectTask }: { tasks: Task[]; activeLabel: string; activeMenu: ActiveMenu; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<Priority>(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const emptyText = activeMenu === 'inbox' ? '暂无未分类任务' : activeMenu === 'today' ? '今天没有待办任务' : activeMenu.startsWith('list-') ? '这个清单暂无任务' : '暂无任务';
  const submit = (): void => {
    if (!title.trim()) return;
    taskApi.addTask(title, { dueDate: selectedDate, listId: selectedList || undefined, priority: selectedPriority });
    setTitle('');
    setSelectedDate(null);
    setSelectedList(null);
    setSelectedPriority(0);
  };
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (over && active.id !== over.id) taskApi.reorderTasks(String(active.id), String(over.id));
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-7 pb-28 pt-4">
        {tasks.length === 0 ? (
          <CenteredState text={emptyText} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
              <div className="mx-auto max-w-4xl space-y-2">
                {tasks.map((task) => (
                  <SortableTaskRow key={task.id} task={task} taskApi={taskApi} onSelectTask={onSelectTask} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <QuickInputBar
        title={title}
        setTitle={setTitle}
        placeholder={`添加任务至 "${activeLabel}"，回车保存`}
        lists={taskApi.lists}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedList={selectedList}
        setSelectedList={setSelectedList}
        selectedPriority={selectedPriority}
        setSelectedPriority={setSelectedPriority}
        onSubmit={submit}
      />
    </div>
  );
}

function SortableTaskRow({ task, taskApi, onSelectTask }: { task: Task; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>
      <TaskRow task={task} taskApi={taskApi} onSelectTask={onSelectTask} />
    </div>
  );
}

function TaskRow({ task, taskApi, onSelectTask }: { task: Task; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const blocked = isTaskBlocked(task, taskApi.tasks);
  const list = taskApi.lists.find((item) => item.id === task.listId);
  const listLabel = list?.label || (task.listId === 'inbox' ? '未分类' : task.listId);
  return (
    <motion.div
      layout
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-[8px] border border-transparent px-0 py-2 transition-colors hover:bg-slate-50/40',
        task.isDone
          ? 'bg-transparent shadow-none'
          : 'bg-transparent shadow-none'
      )}
      onClick={() => onSelectTask(task.id)}
    >
      <TaskCheckbox isDone={task.isDone} isBlocked={blocked} onClick={(event) => { event.stopPropagation(); taskApi.toggleDone(task.id); }} />
      <div className="min-w-0 flex-1">
        <div className={cn('text-[15px] font-medium leading-6', task.isDone && 'text-slate-400 line-through')}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {task.dueDate && (
            <span className={cn('flex items-center gap-1 rounded-[6px] px-2 py-1', isToday(task.dueDate) ? 'bg-blue-50 text-blue-600' : task.dueDate < startOfDay(new Date()).getTime() && !task.isDone ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500')}>
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(task.dueDate)}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-[6px] bg-slate-100 px-2 py-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', list?.color || 'bg-slate-400')} />
            {listLabel}
          </span>
          {task.priority > 0 && (
            <span className="flex items-center gap-1 rounded-[6px] bg-slate-100 px-2 py-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', priorityDotColors[task.priority])} />
              {priorityShortLabels[task.priority]}
            </span>
          )}
          {task.subTasks.length > 0 && <span className="rounded-[6px] bg-slate-100 px-2 py-1">{task.subTasks.filter((sub) => sub.isDone).length}/{task.subTasks.length}</span>}
          {task.tags.map((tag) => {
            const color = getTagColor(tag);
            return <span key={tag} className={cn('rounded-full px-2 py-0.5', color.bg, color.text)}>#{getTagLabel(tag)}</span>;
          })}
        </div>
      </div>
      <Flag className={cn('mt-1 h-4 w-4', priorityColors[task.priority])} />
    </motion.div>
  );
}

function TaskCheckbox({ isDone, isBlocked, onClick }: { isDone: boolean; isBlocked: boolean; onClick: React.MouseEventHandler<HTMLButtonElement> }): React.ReactElement {
  return (
    <button className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all', isDone ? 'border-blue-500 bg-blue-500 text-white shadow-sm' : isBlocked ? 'border-dashed border-slate-300 bg-slate-50/50 text-slate-400' : 'border-slate-300 bg-transparent hover:border-blue-400')} onClick={onClick} title={isBlocked ? '任务被前置任务锁定' : undefined}>
      {isDone && <Check className="h-3.5 w-3.5" />}
      {!isDone && isBlocked && <Lock className="h-3 w-3" />}
    </button>
  );
}

function QuickInputBar(props: {
  title: string;
  setTitle: (title: string) => void;
  placeholder: string;
  lists: TaskList[];
  selectedDate: number | null;
  setSelectedDate: (value: number | null) => void;
  selectedList: string | null;
  setSelectedList: (value: string | null) => void;
  selectedPriority: Priority;
  setSelectedPriority: (value: Priority) => void;
  onSubmit: () => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="absolute bottom-8 left-6 right-6">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 rounded-[14px] border border-slate-200 bg-white/95 px-5 shadow-input">
        <Plus className="h-5 w-5 text-blue-500" />
        <input
          ref={inputRef}
          value={props.title}
          onChange={(event) => props.setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') props.onSubmit();
          }}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-400"
          placeholder={props.placeholder}
        />
        <input className="hidden" type="date" id="quick-date" onChange={(event) => props.setSelectedDate(event.target.value ? new Date(event.target.value).setHours(12, 0, 0, 0) : null)} />
        <label htmlFor="quick-date" title="选择日期" className="cursor-pointer rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Calendar className="h-5 w-5" />
        </label>
        <label title="选择清单" className="relative rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Folder className="h-5 w-5" />
          <select value={props.selectedList || ''} onChange={(event) => props.setSelectedList(event.target.value || null)} className="absolute inset-0 cursor-pointer opacity-0">
            <option value="">清单</option>
            <option value="inbox">未分类</option>
            {props.lists.map((list) => <option key={list.id} value={list.id}>{list.label}</option>)}
          </select>
        </label>
        <label title="选择优先级" className="relative rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Flag className="h-5 w-5" />
          <select value={props.selectedPriority} onChange={(event) => props.setSelectedPriority(Number(event.target.value) as Priority)} className="absolute inset-0 cursor-pointer opacity-0">
            {[0, 1, 2, 3].map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
          </select>
        </label>
        <div className="h-6 w-px bg-slate-200" />
        <button title="语音输入" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={() => inputRef.current?.focus()}>
          <MicOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function CenteredState({ text }: { text: string }): React.ReactElement {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center text-slate-400">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-200 text-slate-300">
        <Check className="h-4 w-4" />
      </div>
      <p className="text-[17px]">{text}</p>
    </div>
  );
}

function KanbanView({ tasks, taskApi, onSelectTask }: { tasks: Task[]; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const columns = [
    { title: '高优先级', priority: 3 as Priority, dot: 'bg-red-500' },
    { title: '中优先级', priority: 2 as Priority, dot: 'bg-yellow-500' },
    { title: '低优先级', priority: 1 as Priority, dot: 'bg-blue-500' },
    { title: '无优先级', priority: 0 as Priority, dot: 'bg-slate-300' }
  ];
  return (
    <div className="flex flex-1 gap-4 overflow-x-auto px-8 py-6">
      {columns.map((column) => (
        <div key={column.priority} className="flex min-w-[264px] flex-1 flex-col rounded-[12px] bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
          <div className="mb-4 flex items-center justify-between px-1">
            <h3 className="flex items-center gap-2 text-[17px] font-bold text-slate-950">
              <span className={cn('h-2 w-2 rounded-full', column.dot)} />
              {column.title}
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-400">{tasks.filter((task) => task.priority === column.priority).length}</span>
          </div>
          <div className="space-y-2 overflow-y-auto">
            {tasks.filter((task) => task.priority === column.priority).map((task) => <TaskCard key={task.id} task={task} taskApi={taskApi} onSelectTask={onSelectTask} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, taskApi, onSelectTask }: { task: Task; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const list = taskApi.lists.find((item) => item.id === task.listId);
  return (
    <button className="w-full rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-left shadow-sm hover:border-blue-200" onClick={() => onSelectTask(task.id)}>
      <div className="flex items-start gap-2">
        <TaskCheckbox isDone={task.isDone} isBlocked={isTaskBlocked(task, taskApi.tasks)} onClick={(event) => { event.stopPropagation(); taskApi.toggleDone(task.id); }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-800">{task.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {task.dueDate && <span>{formatMonthDay(task.dueDate)}</span>}
            {list && <span className="flex items-center gap-1"><span className={cn('h-1.5 w-1.5 rounded-full', list.color)} />{list.label}</span>}
            {task.priority > 0 && <span className={cn('flex items-center gap-1', priorityFlagColors[task.priority])}><Flag className="h-3 w-3" />{priorityShortLabels[task.priority]}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function CalendarView({ tasks, onSelectTask }: { tasks: Task[]; onSelectTask: (id: string) => void }): React.ReactElement {
  const [currentDate, setCurrentDate] = useState(new Date());
  const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="relative flex h-16 flex-shrink-0 items-center justify-center border-b border-slate-100">
        <div className="absolute left-9 flex items-center gap-4 text-sm text-slate-600">
          <button className="rounded-[6px] px-1 py-1 hover:bg-slate-100" onClick={() => setCurrentDate(new Date())}>今天</button>
          <button className="rounded-[6px] p-1 hover:bg-slate-100" title="上个月" onClick={() => setCurrentDate(addMonths(currentDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="rounded-[6px] p-1 hover:bg-slate-100" title="下个月" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-[22px] font-bold text-slate-950">{format(currentDate, 'yyyy年 M月')}</h2>
      </div>
      <div className="grid h-9 flex-shrink-0 grid-cols-7 border-b border-slate-200 bg-white">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => <div key={day} className="flex items-center justify-center text-sm font-medium text-slate-500">周{day}</div>)}
      </div>
      <div className="grid flex-1 grid-cols-7 bg-white">
        {days.map((day) => {
          const note = getCalendarNote(day);
          return (
            <div key={day.toISOString()} className={cn('border-b border-r border-slate-200 p-3', !isSameMonth(day, currentDate) && 'bg-slate-50 text-slate-300')}>
              <div className="mb-2 flex items-start justify-between text-sm">
                <span className={cn('leading-6', isSameDay(day, new Date()) && 'flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-500 px-1.5 text-white')}>{format(day, 'd')}</span>
                {note && <span className="text-xs font-medium text-emerald-500">{note}</span>}
              </div>
              <div className="space-y-1">
                {tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, day)).slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    className={cn(
                      'block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]',
                      task.priority >= 3 ? 'bg-red-50 text-red-600' : task.priority === 2 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-blue-600'
                    )}
                    onClick={() => onSelectTask(task.id)}
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ tasks, taskApi, onSelectTask }: { tasks: Task[]; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const dates = Array.from({ length: 14 }, (_, index) => addDays(startOfDay(new Date()), index - 3));
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 px-6 py-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-bold text-slate-950">时间线</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-400">{tasks.length} 个任务</span>
      </div>
      <div className="flex-1 overflow-auto rounded-[12px] border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[240px_repeat(14,1fr)] border-b border-slate-100">
            <div className="bg-slate-50 p-3 text-sm font-semibold text-slate-500">任务列表</div>
            {dates.map((date) => <div key={date.toISOString()} className="border-l border-slate-100 p-2 text-center text-xs text-slate-400">{format(date, 'M/d')}</div>)}
          </div>
          {tasks.map((task) => (
            <div key={task.id} className="grid min-h-[48px] grid-cols-[240px_repeat(14,1fr)] border-b border-slate-100">
              <button className="flex items-center gap-2 bg-slate-50/40 p-3 text-left text-sm hover:bg-slate-100/70" onClick={() => onSelectTask(task.id)}>
                <TaskCheckbox isDone={task.isDone} isBlocked={isTaskBlocked(task, taskApi.tasks)} onClick={(event) => { event.stopPropagation(); taskApi.toggleDone(task.id); }} />
                <span className={cn('truncate', task.isDone && 'text-slate-400 line-through')}>{task.title}</span>
              </button>
              {dates.map((date) => {
                const active = task.dueDate && date >= startOfDay(new Date(task.startDate || task.dueDate)) && date <= startOfDay(new Date(task.dueDate));
                return <div key={date.toISOString()} className="relative border-l border-slate-100 p-2">{active && <div className="h-6 rounded-full bg-blue-500/80" />}</div>;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatrixView({ tasks, taskApi, onSelectTask }: { tasks: Task[]; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const groups: Array<{ id: MatrixQuadrant; tasks: Task[] }> = matrixQuadrantIds.map((id) => ({
    id,
    tasks: tasks.filter((task) => getMatrixQuadrant(task) === id)
  }));
  const handleDragEnd = (event: DragEndEvent): void => {
    if (!isMatrixQuadrantId(event.over?.id)) return;
    const task = tasks.find((item) => item.id === event.active.id);
    if (!task || getMatrixQuadrant(task) === event.over.id) return;
    taskApi.updateTask(task.id, getMatrixPatchForQuadrant(task, event.over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-6 overflow-hidden p-6">
        {groups.map((group) => (
          <MatrixQuadrantSection key={group.id} group={group} taskApi={taskApi} onSelectTask={onSelectTask} />
        ))}
      </div>
    </DndContext>
  );
}

function MatrixQuadrantSection({ group, taskApi, onSelectTask }: { group: { id: MatrixQuadrant; tasks: Task[] }; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({ id: group.id });
  const meta = matrixQuadrantMeta[group.id];
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[16px] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-[17px] font-bold text-slate-950">
            <span className={cn('h-3 w-3 rounded-full', meta.dot)} />
            {meta.title}
          </h3>
          <p className="mt-1 text-xs text-slate-400">{meta.hint}</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', meta.badge)}>{meta.action}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-0 flex-1 rounded-[14px] transition-colors',
          group.tasks.length === 0 && 'flex items-center justify-center border-2 border-dashed border-slate-100 text-sm italic text-slate-400',
          isOver && 'border-blue-200 bg-blue-50/40'
        )}
      >
        {group.tasks.length === 0 ? (
          <span>拖拽任务至此</span>
        ) : (
          <div className="h-full space-y-3 overflow-y-auto pr-1">
            {group.tasks.map((task) => <MatrixTaskCard key={task.id} task={task} taskApi={taskApi} onSelectTask={onSelectTask} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function MatrixTaskCard({ task, taskApi, onSelectTask }: { task: Task; taskApi: TaskApi; onSelectTask: (id: string) => void }): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const list = taskApi.lists.find((item) => item.id === task.listId);
  const meta = matrixQuadrantMeta[getMatrixQuadrant(task)];
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
    : {};
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn('block w-full cursor-grab rounded-[12px] border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-blue-200 active:cursor-grabbing', isDragging && 'opacity-80 shadow-panel')}
      onClick={() => onSelectTask(task.id)}
    >
      <div className="flex items-start gap-3">
        <TaskCheckbox isDone={task.isDone} isBlocked={isTaskBlocked(task, taskApi.tasks)} onClick={(event) => { event.stopPropagation(); taskApi.toggleDone(task.id); }} />
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-sm font-semibold text-slate-900', task.isDone && 'text-slate-400 line-through')}>{task.title}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {task.dueDate && (
              <span className={cn('flex items-center gap-1 font-semibold', meta.taskDate)}>
                <Calendar className="h-3.5 w-3.5" />
                {formatCompactDate(task.dueDate)}
              </span>
            )}
            {list && <span className="flex items-center gap-1 text-slate-400"><span className={cn('h-1.5 w-1.5 rounded-full', list.color)} />{list.label}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

type DetailDropdown = 'list' | 'priority' | 'repeat' | 'dependency' | null;

const repeatDetailOptions: Array<{ value: RepeatRule['type'] | ''; label: string }> = [
  { value: '', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
  { value: 'workday', label: '工作日' },
  { value: 'lunar', label: '农历' }
];

function openDatePicker(input: HTMLInputElement | null): void {
  if (!input) return;
  const picker = input as HTMLInputElement & { showPicker?: () => void };
  if (typeof picker.showPicker === 'function') {
    picker.showPicker();
    return;
  }
  input.click();
}

function TaskDetail({ task, taskApi, onClose, onSelectTask }: { task: Task; taskApi: TaskApi; onClose: () => void; onSelectTask: (id: string) => void }): React.ReactElement {
  const [subTitle, setSubTitle] = useState('');
  const [openDropdown, setOpenDropdown] = useState<DetailDropdown>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const dependencyTasks = taskApi.tasks.filter((candidate) => candidate.id !== task.id);
  const currentList = taskApi.lists.find((item) => item.id === task.listId);
  const listLabel = currentList?.label || (task.listId === 'inbox' ? '未分类' : task.listId);
  const listColor = currentList?.color || 'bg-slate-400';
  const listOptions = [{ id: 'inbox', label: '未分类', color: 'bg-slate-400' }, ...taskApi.lists];
  const dueInputId = `detail-due-${task.id}`;
  const startInputId = `detail-start-${task.id}`;

  useEffect(() => {
    setOpenDropdown(null);
  }, [task.id]);

  const setRepeat = (type: RepeatRule['type'] | ''): void => {
    taskApi.updateTask(task.id, { repeatRule: type ? { type, interval: 1 } : undefined });
  };
  const deleteAndClose = (): void => {
    taskApi.deleteTask(task.id);
    onClose();
  };

  return (
    <motion.aside
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
      className="absolute right-0 top-0 z-50 h-full w-[340px] border-l border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.14)]"
      data-testid="task-detail-panel"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4">
          <TaskCheckbox isDone={task.isDone} isBlocked={isTaskBlocked(task, taskApi.tasks)} onClick={() => taskApi.toggleDone(task.id)} />
          <div className="flex items-center gap-1 text-slate-500">
            <button title="置顶" className="rounded p-1.5 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"><Pin className="h-4 w-4" /></button>
            <button title="删除任务" className="rounded p-1.5 transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:bg-red-50 focus-visible:text-red-500 focus-visible:outline-none" onClick={deleteAndClose}><Trash2 className="h-4 w-4" /></button>
            <button title="更多" className="rounded p-1.5 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"><MoreHorizontal className="h-4 w-4" /></button>
            <button title="收起详情" className="rounded p-1.5 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none" onClick={onClose}><PanelRightClose className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <input data-testid="detail-title-input" value={task.title} onChange={(event) => taskApi.updateTask(task.id, { title: event.target.value })} className="mb-6 w-full bg-transparent text-[20px] font-bold leading-8 text-slate-950 outline-none" />
          <div className="space-y-5">
            <DetailField icon={Calendar} label="日期">
              <div className="relative flex items-center gap-2">
                <DetailDateButton testId="detail-start-button" onClick={() => openDatePicker(startDateRef.current)}>
                  {task.startDate ? getDetailDateLabel(task.startDate) : '开始日期'}
                </DetailDateButton>
                <span className="text-slate-300">-</span>
                <DetailDateButton testId="detail-due-button" onClick={() => openDatePicker(dueDateRef.current)}>
                  {getDetailDateLabel(task.dueDate)}
                </DetailDateButton>
                <label htmlFor={dueInputId} className="ml-auto cursor-pointer rounded p-1 text-slate-500 transition-colors hover:bg-slate-100">
                  <Calendar className="h-4 w-4" />
                </label>
                <input
                  ref={startDateRef}
                  id={startInputId}
                  type="date"
                  value={dateInputValue(task.startDate)}
                  onChange={(event) => taskApi.updateTask(task.id, { startDate: event.target.value ? new Date(event.target.value).setHours(9, 0, 0, 0) : null })}
                  className="absolute h-px w-px opacity-0"
                  tabIndex={-1}
                />
                <input
                  ref={dueDateRef}
                  id={dueInputId}
                  type="date"
                  value={dateInputValue(task.dueDate)}
                  onChange={(event) => taskApi.updateTask(task.id, { dueDate: event.target.value ? new Date(event.target.value).setHours(12, 0, 0, 0) : null })}
                  className="absolute h-px w-px opacity-0"
                  tabIndex={-1}
                />
              </div>
            </DetailField>
            <DetailField icon={Folder} label="清单">
              <DetailSelectButton testId="detail-list-button" onClick={() => setOpenDropdown(openDropdown === 'list' ? null : 'list')}>
                <span className={cn('h-2 w-2 rounded-full', listColor)} />
                <span>{listLabel}</span>
              </DetailSelectButton>
              {openDropdown === 'list' && (
                <DetailPopover className="w-[174px]">
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700">
                    <Folder className="h-4 w-4 text-blue-400" />
                    <span>{listLabel}</span>
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  {listOptions.map((list) => (
                    <button key={list.id} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none" onClick={() => { taskApi.updateTask(task.id, { listId: list.id }); setOpenDropdown(null); }}>
                      <span className={cn('h-2 w-2 rounded-full', list.color)} />
                      {list.label}
                    </button>
                  ))}
                </DetailPopover>
              )}
            </DetailField>
            <DetailField icon={Flag} label="优先级">
              <DetailSelectButton testId="detail-priority-button" onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')} className={priorityFlagColors[task.priority]}>
                <span>{getPriorityDetailLabel(task.priority)}</span>
              </DetailSelectButton>
              {openDropdown === 'priority' && (
                <DetailPopover className="w-[136px]">
                  {[0, 1, 2, 3].map((priority) => (
                    <button key={priority} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none', priorityFlagColors[priority])} onClick={() => { taskApi.updateTask(task.id, { priority: priority as Priority }); setOpenDropdown(null); }}>
                      <Flag className="h-3.5 w-3.5" />
                      {getPriorityDetailLabel(priority as Priority)}
                    </button>
                  ))}
                </DetailPopover>
              )}
            </DetailField>
            <DetailField icon={Tag} label="标签">
              <div className="flex flex-wrap items-center gap-2">
                {task.tags.map((tag) => {
                  const color = getTagColor(tag);
                  return <span key={tag} className={cn('rounded-[6px] px-2 py-1 text-xs', color.bg, color.text)}>#{getTagLabel(tag)}</span>;
                })}
                <button className="rounded-[6px] border border-dashed border-slate-300 px-2 py-0.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600">+</button>
              </div>
            </DetailField>
            <DetailField icon={Bell} label="重复">
              <DetailSelectButton testId="detail-repeat-button" onClick={() => setOpenDropdown(openDropdown === 'repeat' ? null : 'repeat')} className="text-slate-500">
                <span>{getRepeatDetailLabel(task.repeatRule?.type)}</span>
              </DetailSelectButton>
              {openDropdown === 'repeat' && (
                <DetailPopover className="w-[136px]">
                  {repeatDetailOptions.map((option) => (
                    <button key={option.value || 'none'} className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none" onClick={() => { setRepeat(option.value); setOpenDropdown(null); }}>
                      {option.label}
                    </button>
                  ))}
                </DetailPopover>
              )}
            </DetailField>
          </div>
          <div className="mt-7 border-t border-slate-100 pt-5">
            <textarea
              value={task.content || ''}
              onChange={(event) => taskApi.updateTask(task.id, { content: event.target.value })}
              placeholder="添加描述..."
              className="min-h-[112px] w-full resize-none bg-transparent text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="mt-7 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-slate-400" />添加子任务</span>
            </div>
            <div className="space-y-2">
              {task.subTasks.map((subTask) => (
                <label key={subTask.id} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={subTask.isDone} onChange={(event) => taskApi.updateTask(task.id, { subTasks: task.subTasks.map((item) => item.id === subTask.id ? { ...item, isDone: event.target.checked } : item) })} />
                  <span className={cn(subTask.isDone && 'line-through text-slate-400')}>{subTask.title}</span>
                </label>
              ))}
            </div>
            <input value={subTitle} onChange={(event) => setSubTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && subTitle.trim()) { taskApi.updateTask(task.id, { subTasks: [...task.subTasks, { id: createId('sub'), title: subTitle.trim(), isDone: false }] }); setSubTitle(''); } }} placeholder="添加子任务" className="mt-2 w-full rounded-[8px] border border-transparent px-2 py-2 text-sm text-slate-500 outline-none hover:border-slate-200" />
          </div>
          <div className="mt-7 border-t border-slate-100 pt-4">
            <DetailField icon={Archive} label="依赖关系">
              <DetailSelectButton testId="detail-dependency-button" onClick={() => setOpenDropdown(openDropdown === 'dependency' ? null : 'dependency')} className="text-slate-500">
                <Plus className="h-3.5 w-3.5" />
                <span>添加</span>
              </DetailSelectButton>
              {openDropdown === 'dependency' && (
                <DetailPopover className="w-[220px]">
                  <button className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none" onClick={() => { taskApi.updateTask(task.id, { blockedBy: [] }); setOpenDropdown(null); }}>无依赖</button>
                  {dependencyTasks.map((candidate) => (
                    <button key={candidate.id} className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none" onClick={() => { taskApi.updateTask(task.id, { blockedBy: [candidate.id] }); setOpenDropdown(null); }}>{candidate.title}</button>
                  ))}
                </DetailPopover>
              )}
            </DetailField>
            {task.blockedBy?.map((id) => {
              const dependency = taskApi.tasks.find((item) => item.id === id);
              return dependency ? <button key={id} className="mt-2 rounded-[8px] bg-orange-50 px-3 py-2 text-left text-sm text-orange-700" onClick={() => onSelectTask(id)}>{dependency.title}</button> : null;
            })}
          </div>
        </div>
        <div className="border-t border-slate-100 p-4">
          <button data-testid="detail-delete-button" className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-red-50 py-2 text-sm text-red-600 transition-colors hover:bg-red-100" onClick={deleteAndClose}>
            <Trash2 className="h-4 w-4" />
            删除任务
          </button>
        </div>
      </div>
    </motion.aside>
  );
}

function DetailDateButton({ children, onClick, testId }: { children: React.ReactNode; onClick: () => void; testId?: string }): React.ReactElement {
  return (
    <button
      data-testid={testId}
      className="inline-flex items-center rounded-[6px] px-2 py-1 text-sm leading-none text-blue-500 transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DetailField({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="relative grid grid-cols-[88px_1fr] items-center gap-3 text-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="min-w-0 text-slate-700">{children}</div>
    </div>
  );
}

function DetailSelectButton({ children, onClick, className, testId }: { children: React.ReactNode; onClick: () => void; className?: string; testId?: string }): React.ReactElement {
  return (
    <button data-testid={testId} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-[6px] px-2 py-1 text-left text-sm leading-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none', className)} onClick={onClick}>
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate">{children}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </button>
  );
}

function DetailPopover({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <motion.div
      initial={{ y: -2, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -2, opacity: 0 }}
      transition={{ duration: 0.12 }}
      className={cn('absolute left-[101px] top-8 z-[60] rounded-[10px] border border-slate-100 bg-white py-2 shadow-[0_16px_30px_rgba(15,23,42,0.16)]', className)}
      data-testid="detail-popover"
    >
      {children}
    </motion.div>
  );
}

type QuickAddDropdown = 'list' | 'priority' | 'tag' | null;

function QuickAddModal({ taskApi, onClose }: { taskApi: TaskApi; onClose: () => void }): React.ReactElement {
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<Priority>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<QuickAddDropdown>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const listOptions = [{ id: 'inbox', label: '未分类', color: 'bg-slate-400' }, ...taskApi.lists];
  const selectedListOption = listOptions.find((list) => list.id === selectedList);
  const canSave = title.trim().length > 0;
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);
  const submit = (): void => {
    if (!canSave) return;
    const options: Partial<Task> = { priority: selectedPriority };
    if (selectedDate !== null) options.dueDate = selectedDate;
    if (selectedList) options.listId = selectedList;
    if (selectedTags.length > 0) options.tags = selectedTags;
    taskApi.addTask(title, options);
    onClose();
  };
  const toggleTag = (tagId: string): void => {
    setSelectedTags((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-start justify-center bg-slate-200/70 pt-[130px] backdrop-blur-[4px]"
      onMouseDown={onClose}
      data-testid="quick-add-overlay"
    >
      <motion.div
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
        transition={{ duration: 0.16 }}
        className="w-[680px] overflow-visible rounded-[13px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
        data-testid="quick-add-modal"
      >
        <div className="flex h-20 items-center px-6">
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
              if (event.key === 'Escape') onClose();
            }}
            placeholder="想做点什么?"
            className="h-full w-full bg-transparent text-[28px] font-semibold leading-none text-slate-900 outline-none placeholder:text-slate-300"
            data-testid="quick-add-title-input"
          />
        </div>
        <div className="flex h-14 items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-6">
          <div className="relative">
            <QuickAddToolButton icon={Calendar} label={selectedDate ? formatDate(selectedDate) : '日期'} onClick={() => openDatePicker(dateInputRef.current)} testId="quick-add-date-button" active={selectedDate !== null} />
            <input
              ref={dateInputRef}
              type="date"
              value={dateInputValue(selectedDate)}
              onChange={(event) => setSelectedDate(event.target.value ? new Date(event.target.value).setHours(12, 0, 0, 0) : null)}
              className="absolute h-px w-px opacity-0"
              tabIndex={-1}
              data-testid="quick-add-date-input"
            />
          </div>
          <div className="relative">
            <QuickAddToolButton icon={Folder} label={selectedListOption?.label || '清单'} onClick={() => setOpenDropdown(openDropdown === 'list' ? null : 'list')} testId="quick-add-list-button" active={Boolean(selectedList)} />
            {openDropdown === 'list' && (
              <QuickAddPopover>
                {listOptions.map((list) => (
                  <button key={list.id} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none" onClick={() => { setSelectedList(list.id); setOpenDropdown(null); }}>
                    <span className={cn('h-2 w-2 rounded-full', list.color)} />
                    {list.label}
                  </button>
                ))}
              </QuickAddPopover>
            )}
          </div>
          <div className="relative">
            <QuickAddToolButton icon={Flag} label={selectedPriority > 0 ? priorityShortLabels[selectedPriority] : '优先级'} onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')} testId="quick-add-priority-button" active={selectedPriority > 0} className={selectedPriority > 0 ? priorityFlagColors[selectedPriority] : undefined} />
            {openDropdown === 'priority' && (
              <QuickAddPopover>
                {[0, 1, 2, 3].map((priority) => (
                  <button key={priority} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none', priorityFlagColors[priority])} onClick={() => { setSelectedPriority(priority as Priority); setOpenDropdown(null); }}>
                    <Flag className="h-3.5 w-3.5" />
                    {priorityLabels[priority]}
                  </button>
                ))}
              </QuickAddPopover>
            )}
          </div>
          <div className="relative">
            <QuickAddToolButton icon={Tag} label={selectedTags.length > 0 ? selectedTags.map((tag) => `#${getTagLabel(tag)}`).join(' ') : '标签'} onClick={() => setOpenDropdown(openDropdown === 'tag' ? null : 'tag')} testId="quick-add-tag-button" active={selectedTags.length > 0} className="max-w-[150px]" />
            {openDropdown === 'tag' && (
              <QuickAddPopover className="w-[180px]">
                {taskApi.availableTags.map((tag) => {
                  const selected = selectedTags.includes(tag.id);
                  return (
                    <button key={tag.id} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none" onClick={() => toggleTag(tag.id)}>
                      <span className="truncate">#{tag.label}</span>
                      {selected && <Check className="h-3.5 w-3.5 text-blue-500" />}
                    </button>
                  );
                })}
              </QuickAddPopover>
            )}
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <button title="语音输入" className="rounded-[6px] p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:bg-slate-100 focus-visible:outline-none" onClick={() => inputRef.current?.focus()}>
            <MicOff className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400">↵ 保存, Esc 取消</span>
            <button
              className={cn(
                'h-9 rounded-[9px] px-4 text-sm font-medium transition-colors',
                canSave ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600 focus-visible:bg-blue-600 focus-visible:outline-none' : 'cursor-default bg-slate-200 text-slate-400'
              )}
              disabled={!canSave}
              onClick={submit}
              data-testid="quick-add-save-button"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuickAddToolButton({ icon: Icon, label, onClick, active, className, testId }: { icon: typeof Calendar; label: string; onClick: () => void; active?: boolean; className?: string; testId?: string }): React.ReactElement {
  return (
    <button
      className={cn('flex min-w-0 items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:bg-slate-100 focus-visible:outline-none', active && 'bg-blue-50 text-blue-500', className)}
      onClick={onClick}
      data-testid={testId}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function QuickAddPopover({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <motion.div
      initial={{ y: -2, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -2, opacity: 0 }}
      transition={{ duration: 0.12 }}
      className={cn('absolute left-0 top-9 z-50 w-[160px] overflow-hidden rounded-[10px] border border-slate-100 bg-white py-1 shadow-[0_16px_30px_rgba(15,23,42,0.16)]', className)}
      data-testid="quick-add-popover"
    >
      {children}
    </motion.div>
  );
}

function SearchModal({ tasks, lists, onSelectTask, onClose }: { tasks: Task[]; lists: TaskList[]; onSelectTask: (id: string) => void; onClose: () => void }): React.ReactElement {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);
  const results = tasks.filter((task) => `${task.title} ${task.content || ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 20);
  return (
    <ModalFrame onClose={onClose}>
      <div className="w-[560px] overflow-hidden rounded-[14px] bg-white shadow-panel">
        <div className="flex h-14 items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-5 w-5 text-slate-400" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }} placeholder="搜索任务..." className="flex-1 bg-transparent outline-none" />
          <kbd className="rounded border border-slate-200 px-1.5 text-xs text-slate-400">Esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {results.length === 0 ? <div className="py-12 text-center text-slate-400">{query ? '没有找到匹配任务' : '输入关键字开始搜索'}</div> : results.map((task) => (
            <button key={task.id} className="block w-full rounded-[8px] px-3 py-2 text-left hover:bg-slate-50" onClick={() => { onSelectTask(task.id); onClose(); }}>
              <div className="font-medium">{task.title}</div>
              <div className="text-xs text-slate-400">{lists.find((list) => list.id === task.listId)?.label || '未分类'} · {formatDate(task.dueDate)}</div>
            </button>
          ))}
        </div>
      </div>
    </ModalFrame>
  );
}

function SettingsDialog({ tasks, setTasks, onClose }: { tasks: Task[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>>; onClose: () => void }): React.ReactElement {
  const [shortcut, setShortcut] = useState(localStorage.getItem('globalShortcut') || 'Option+Space');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exported = exportToObsidian(tasks);
  const saveShortcut = (): void => {
    localStorage.setItem('globalShortcut', shortcut);
    window.electron?.ipcRenderer.send('update-shortcut', shortcut);
  };
  const exportMarkdown = (): void => {
    const url = URL.createObjectURL(new Blob([exported], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `DoneBox-${format(new Date(), 'yyyyMMdd')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importMarkdownFile = async (file?: File): Promise<void> => {
    if (!file) return;
    const markdown = await file.text();
    if (markdown.trim()) setTasks((current) => [...importFromObsidian(markdown), ...current]);
  };
  const resetDefaults = (): void => {
    setShortcut('Option+Space');
    localStorage.setItem('globalShortcut', 'Option+Space');
    window.electron?.ipcRenderer.send('update-shortcut', 'Option+Space');
  };
  return (
    <ModalFrame onClose={onClose}>
      <div className="w-[500px] overflow-hidden rounded-[8px] bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Settings className="h-5 w-5" />设置</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">
          <section>
            <h3 className="mb-5 text-sm font-semibold text-slate-500">快捷键</h3>
            <div className="mb-3 text-sm text-slate-950">全局快速添加任务</div>
            <div className="flex gap-3">
              <input value={shortcut} onChange={(event) => setShortcut(event.target.value)} className="h-10 flex-1 rounded-[6px] border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 outline-none" />
              <button className="h-10 w-[60px] rounded-[6px] bg-slate-100 text-sm text-slate-900 hover:bg-slate-200" onClick={saveShortcut}>修改</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">提示：点击修改后，直接按下想要设置的组合键。</p>
          </section>

          <section className="mt-8">
            <h3 className="mb-5 text-sm font-semibold text-slate-500">数据导入与导出</h3>
            <div className="mb-4 text-sm text-slate-950">Obsidian 联动</div>
            <div className="flex gap-3">
              <button className="flex h-10 items-center gap-2 rounded-[6px] bg-slate-100 px-4 text-sm text-slate-900 hover:bg-slate-200" onClick={exportMarkdown}>
                <Download className="h-4 w-4" />导出到 Obsidian
              </button>
              <button className="flex h-10 items-center gap-2 rounded-[6px] bg-slate-100 px-4 text-sm text-slate-900 hover:bg-slate-200" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />从 Obsidian 导入
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                className="hidden"
                onChange={(event) => {
                  importMarkdownFile(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">提示：导出为 Markdown 格式文件；导入时会自动解析带有 `-[ ]` 的任务行。</p>
          </section>

          <section className="mt-8">
            <h3 className="mb-5 text-sm font-semibold text-slate-500">恢复默认</h3>
            <button className="flex h-10 items-center gap-2 rounded-[6px] bg-slate-100 px-4 text-sm text-slate-900 hover:bg-slate-200" onClick={resetDefaults}>
              <RotateCcw className="h-4 w-4" />恢复默认设置
            </button>
            <p className="mt-3 text-xs text-slate-500">仅恢复快捷键、主题、默认标签显示和当前界面状态，不会删除任务、清单和习惯。</p>
          </section>

          <div className="pt-8 text-center text-xs text-slate-500">DoneBox · Put it in. Get it done.</div>
          </div>
      </div>
    </ModalFrame>
  );
}

function PomodoroTimer({ onClose }: { onClose: () => void }): React.ReactElement {
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!active) setTimeLeft((mode === 'work' ? workDuration : breakDuration) * 60);
  }, [workDuration, breakDuration, mode, active]);
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      setTimeLeft((current) => {
        const next = Math.max(0, current - 1);
        const text = `${Math.floor(next / 60).toString().padStart(2, '0')}:${(next % 60).toString().padStart(2, '0')}`;
        window.electron?.ipcRenderer.send('update-timer', text);
        if (next === 0) {
          window.electron?.ipcRenderer.send('update-timer', '');
          new Notification('番茄钟', { body: mode === 'work' ? '专注时间结束，休息一下吧！' : '休息结束，准备开始专注！' });
          setActive(false);
          setMode(mode === 'work' ? 'break' : 'work');
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [active, mode]);
  useEffect(() => () => window.electron?.ipcRenderer.send('update-timer', ''), []);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute right-5 top-[52px] z-50 w-[255px] rounded-[8px] border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold"><Timer className="h-4 w-4 text-blue-500" />番茄钟</div>
        <button className="text-slate-400 hover:text-slate-700" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="mb-5 grid grid-cols-2 rounded-[6px] bg-slate-50 p-1 text-sm">
        <button className={cn('rounded-[4px] py-1', mode === 'work' && 'bg-white shadow-sm')} onClick={() => setMode('work')}>专注</button>
        <button className={cn('rounded-[4px] py-1', mode === 'break' && 'bg-white shadow-sm')} onClick={() => setMode('break')}>休息</button>
      </div>
      <div className="mb-5 flex items-end justify-center text-5xl font-light tracking-normal">
        <input title="点击修改分钟数" value={mode === 'work' ? workDuration : breakDuration} onChange={(event) => mode === 'work' ? setWorkDuration(Number(event.target.value) || 1) : setBreakDuration(Number(event.target.value) || 1)} className="w-[70px] bg-transparent text-right outline-none" />
        <span className="text-slate-100">:{seconds.toString().padStart(2, '0')}</span>
      </div>
      <div className="flex gap-2">
        <button className="flex flex-1 items-center justify-center gap-1 rounded-[6px] border border-slate-200 py-1.5 text-sm" onClick={() => setActive(!active)}>{active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{active ? '暂停' : '开始'}</button>
        <button title="重置" className="rounded-[6px] border border-slate-200 px-3" onClick={() => { setActive(false); setTimeLeft((mode === 'work' ? workDuration : breakDuration) * 60); window.electron?.ipcRenderer.send('update-timer', ''); }}><RotateCcw className="h-4 w-4" /></button>
      </div>
      <span className="sr-only">{minutes}</span>
    </motion.div>
  );
}

function ModalFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }): React.ReactElement {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.98, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: 10 }} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </motion.div>
    </motion.div>
  );
}
