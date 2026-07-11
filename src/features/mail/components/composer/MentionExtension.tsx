import { useCallback, useEffect, useState } from "react";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { searchContacts, type DbContact } from "@features/contacts/db/contacts.ts";

function MentionList({ items, command }: SuggestionProps<DbContact>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.email, label: item.display_name || item.email });
      }
    },
    [items, command],
  );
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);
  if (items.length === 0) {
    return (
      <div className="mention-popup">
        <div className="px-3 py-2 text-xs text-text-tertiary">
          No contacts found
        </div>
      </div>
    );
  }
  return (
    <div className="mention-popup">
      {items.map((item, index) => (
        <button
          key={item.email}
          onMouseDown={() => selectItem(index)}
          className={`mention-item ${index === selectedIndex ? "is-selected" : ""}`}
        >
          <div className="mention-avatar">
            {(item.display_name || item.email)[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="mention-info">
            <span className="mention-name">
              {item.display_name || item.email}
            </span>
            {item.display_name && (
              <span className="mention-email">{item.email}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export const CustomMention = Mention.configure({
  HTMLAttributes: { class: "mention-tag" },
  suggestion: {
    char: "@",
    items: async ({ query }): Promise<DbContact[]> => {
      if (!query || query.length < 1) return [];
      try {
        return await searchContacts(query, 5);
      } catch {
        return [];
      }
    },
    render: () => {
      let component: ReactRenderer | null = null;
      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });
          const el = component.element as HTMLElement;
          el.style.position = "absolute";
          el.style.zIndex = "9999";
          if (!el.parentElement) document.body.appendChild(el);
          const coords = props.clientRect?.();
          if (coords) {
            el.style.top = `${coords.bottom + 4}px`;
            el.style.left = `${coords.left}px`;
          }
        },
        onUpdate: (props) => {
          component?.updateProps(props);
          const el = component?.element as HTMLElement;
          const coords = props.clientRect?.();
          if (coords && el) {
            el.style.top = `${coords.bottom + 4}px`;
            el.style.left = `${coords.left}px`;
          }
        },
        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            component?.destroy();
            component = null;
            return true;
          }
          return false;
        },
        onExit: () => {
          component?.destroy();
          component = null;
        },
      };
    },
  },
});
