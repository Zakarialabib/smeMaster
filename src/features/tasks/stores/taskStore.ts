import { create } from "zustand";
import type { DbTask, TaskPriority } from "@features/tasks/db/tasks";
import { initialAsyncState } from "@shared/stores/createAsyncStore";

export type TaskGroupBy = "none" | "priority" | "dueDate" | "tag";
export type TaskFilterStatus = "all" | "incomplete" | "completed";

// View mode types (additive)
export type TaskViewMode = "list" | "kanban" | "calendar" | "agenda";
export type TaskDensity = "compact" | "normal" | "comfortable";
export type TaskDateFilter = "all" | "today" | "thisWeek" | "overdue";
export type TaskSortField = "priority" | "dueDate" | "created" | "title";

// AI Task Suggestion (additive)
export interface AiTaskSuggestion {
  id: string;
  title: string;
  sourceEmailId: string;
  sourceEmailSubject: string;
  sourceSender: string;
  suggestedDueDate?: number;
  suggestedPriority?: TaskPriority;
  confidence: number;
}

interface TaskState {
  tasks: DbTask[];
  threadTasks: DbTask[];
  selectedTaskId: string | null;
  incompleteCount: number;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  aiSuggestions: AiTaskSuggestion[];

  setTasks: (tasks: DbTask[]) => void;
  setThreadTasks: (tasks: DbTask[]) => void;
  addTask: (task: DbTask) => void;
  updateTaskInStore: (id: string, updates: Partial<DbTask>) => void;
  removeTask: (id: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  setIncompleteCount: (count: number) => void;
  setSearchQuery: (query: string) => void;

  setAiSuggestions: (suggestions: AiTaskSuggestion[]) => void;
  dismissAiSuggestions: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  threadTasks: [],
  selectedTaskId: null,
  incompleteCount: 0,
  searchQuery: "",
  aiSuggestions: [],
  ...initialAsyncState,

  setTasks: (tasks) => set({ tasks }),
  setThreadTasks: (threadTasks) => set({ threadTasks }),
  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks],
      incompleteCount: task.is_completed ? state.incompleteCount : state.incompleteCount + 1,
    })),
  updateTaskInStore: (id, updates) =>
    set((state) => {
      const updateList = (list: DbTask[]) =>
        list.map((t) => (t.id === id ? { ...t, ...updates } : t));
      let countDelta = 0;
      if (updates.is_completed !== undefined) {
        const existing = state.tasks.find((t) => t.id === id) ?? state.threadTasks.find((t) => t.id === id);
        if (existing) {
          if (updates.is_completed && !existing.is_completed) countDelta = -1;
          if (!updates.is_completed && existing.is_completed) countDelta = 1;
        }
      }
      return {
        tasks: updateList(state.tasks),
        threadTasks: updateList(state.threadTasks),
        incompleteCount: state.incompleteCount + countDelta,
      };
    }),
  removeTask: (id) =>
    set((state) => {
      const removed = state.tasks.find((t) => t.id === id);
      const countDelta = removed && !removed.is_completed ? -1 : 0;
      return {
        tasks: state.tasks.filter((t) => t.id !== id),
        threadTasks: state.threadTasks.filter((t) => t.id !== id),
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
        incompleteCount: state.incompleteCount + countDelta,
      };
    }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setIncompleteCount: (incompleteCount) => set({ incompleteCount }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setAiSuggestions: (aiSuggestions) => set({ aiSuggestions }),
  dismissAiSuggestions: () => set({ aiSuggestions: [] }),
}));
