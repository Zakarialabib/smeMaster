import { useCallback } from "react";
import { Type, Variable, Image, MousePointerClick, GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export type BlockType = "text" | "variable" | "image" | "cta" | "conditional";

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: string;
  config?: Record<string, string>;
}

interface Props {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  variables?: string[];
}

function generateId() {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const BLOCK_TEMPLATES: { type: BlockType; label: string; icon: typeof Type; defaultContent: string }[] = [
  { type: "text", label: "Text", icon: Type, defaultContent: "Enter text here..." },
  { type: "variable", label: "Variable", icon: Variable, defaultContent: "{{first_name}}" },
  { type: "image", label: "Image", icon: Image, defaultContent: "https://example.com/image.png" },
  { type: "cta", label: "Button", icon: MousePointerClick, defaultContent: "Click here" },
  { type: "conditional", label: "Conditional", icon: Variable, defaultContent: "{% if condition %}Show this{% endif %}" },
];

export function BlockEditor({ blocks, onChange, variables }: Props) {
  const addBlock = useCallback((type: BlockType) => {
    const template = BLOCK_TEMPLATES.find(t => t.type === type);
    onChange([...blocks, { id: generateId(), type, content: template?.defaultContent ?? "" }]);
  }, [blocks, onChange]);

  const updateBlock = useCallback((id: string, content: string) => {
    onChange(blocks.map(b => b.id === id ? { ...b, content } : b));
  }, [blocks, onChange]);

  const removeBlock = useCallback((id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  }, [blocks, onChange]);

  const moveBlock = useCallback((id: string, direction: "up" | "down") => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const newBlocks = [...blocks];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newBlocks.length) return;
    const tmp = newBlocks[idx]!;
    newBlocks[idx] = newBlocks[targetIdx]!;
    newBlocks[targetIdx] = tmp;
    onChange(newBlocks);
  }, [blocks, onChange]);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap p-2 bg-bg-primary rounded-lg border border-border-primary">
        {BLOCK_TEMPLATES.map((t) => (
          <button
            key={t.type}
            onClick={() => addBlock(t.type)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Blocks */}
      {blocks.length === 0 && (
        <div className="flex items-center justify-center py-8 text-sm text-text-tertiary border-2 border-dashed border-border-primary rounded-lg">
          Click a block type above to start building
        </div>
      )}

      {blocks.map((block, idx) => (
        <div key={block.id} className="group flex items-start gap-2 p-2 bg-bg-primary rounded-lg border border-border-primary">
          {/* Drag handle + move */}
          <div className="flex flex-col items-center gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => moveBlock(block.id, "up")} disabled={idx === 0} className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30">
              <ChevronUp size={12} />
            </button>
            <GripVertical size={14} className="text-text-tertiary" />
            <button onClick={() => moveBlock(block.id, "down")} disabled={idx === blocks.length - 1} className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30">
              <ChevronDown size={12} />
            </button>
          </div>

          {/* Block content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">{block.type}</span>
              <button onClick={() => removeBlock(block.id)} className="p-0.5 text-text-tertiary hover:text-danger transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
            {block.type === "text" || block.type === "conditional" ? (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                className="w-full px-2 py-1 text-sm rounded border border-border-primary bg-bg-secondary resize-y min-h-[60px]"
                rows={2}
              />
            ) : block.type === "variable" ? (
              <select
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                className="w-full px-2 py-1 text-sm rounded border border-border-primary bg-bg-secondary"
              >
                {(variables ?? ["{{first_name}}", "{{last_name}}", "{{company}}", "{{email}}"]).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
                <option value="__custom__">Custom...</option>
              </select>
            ) : (
              <input
                type={block.type === "image" ? "url" : "text"}
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                placeholder={block.type === "image" ? "Image URL..." : "Button text..."}
                className="w-full px-2 py-1 text-sm rounded border border-border-primary bg-bg-secondary"
              />
            )}
          </div>
        </div>
      ))}

      {/* Preview */}
      {blocks.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-primary">Preview</summary>
          <div className="mt-2 p-3 bg-bg-primary rounded-lg border border-border-primary text-sm text-text-primary">
            {blocks.map(b => (
              <div key={b.id} className="mb-1 last:mb-0">{b.content}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
