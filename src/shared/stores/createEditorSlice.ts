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
  set: (
    state: Partial<EditorSlice<T, S>> | ((state: EditorSlice<T, S>) => Partial<EditorSlice<T, S>>),
  ) => void,
  options: EditorSliceOptions<T, S>,
): EditorSlice<T, S> {
  return {
    showEditor: false,
    editor: { ...options.defaultEditor },

    openEditor: () => {
      set({ showEditor: true, editor: { ...options.defaultEditor } });
    },

    openEditorForEdit: (item: S) => {
      const editorState = options.onItemSelect
        ? { ...options.defaultEditor, ...options.onItemSelect(item) }
        : { ...options.defaultEditor, ...(item as unknown as T) };
      set({ showEditor: true, editor: editorState });
    },

    closeEditor: () => {
      set({ showEditor: false, editor: { ...options.defaultEditor } });
    },

    resetEditor: () => {
      set({ editor: { ...options.defaultEditor } });
    },

    setEditorField: <K extends keyof T>(field: K, value: T[K]) => {
      set((state) => ({
        editor: { ...state.editor, [field]: value },
      }));
    },
  };
}
