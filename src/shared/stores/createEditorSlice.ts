import type { StoreApi } from "zustand";

export interface EditorSlice<T, S = T> {
  showEditor: boolean;
  editor: T;
  openEditor: () => void;
  openEditorForEdit: (item: S) => void;
  closeEditor: () => void;
  setEditorField: <K extends keyof T>(field: K, value: T[K]) => void;
  resetEditor: () => void;
}

export interface EditorSliceOptions<T, S = T> {
  defaultEditor: T;
  onItemSelect?: (source: S) => Partial<T>;
}

export function createEditorSlice<T, S = T>(
  set: StoreApi<any>["setState"],
  _get: StoreApi<any>["getState"],
  options: EditorSliceOptions<T, S>,
): EditorSlice<T, S> {
  const setState = (state: Partial<EditorSlice<T>> | ((state: EditorSlice<T>) => Partial<EditorSlice<T>>)) => set(state as any);

  return {
    showEditor: false,
    editor: { ...options.defaultEditor },

    openEditor: () => {
      setState({ showEditor: true, editor: { ...options.defaultEditor } });
    },

    openEditorForEdit: (item: S) => {
      const editorState = options.onItemSelect
        ? { ...options.defaultEditor, ...options.onItemSelect(item) }
        : { ...options.defaultEditor, ...(item as unknown as T) };
      setState({ showEditor: true, editor: editorState });
    },

    closeEditor: () => {
      setState({ showEditor: false, editor: { ...options.defaultEditor } });
    },

    resetEditor: () => {
      setState({ editor: { ...options.defaultEditor } });
    },

    setEditorField: <K extends keyof T>(field: K, value: T[K]) => {
      setState((state: EditorSlice<T>) => ({
        editor: { ...state.editor, [field]: value },
      }));
    },
  };
}