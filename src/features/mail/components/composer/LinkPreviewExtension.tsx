import { useState, useEffect } from "react";
import { Node as TipTapNode, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "prosemirror-state";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { NodeViewWrapperProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { ExternalLink } from "lucide-react";

interface OgMetadata {
  title: string;
  description: string;
  favicon: string | null;
  url: string;
  siteName: string | null;
}

const ogCache = new Map<string, OgMetadata | null>();

async function fetchOgMetadata(url: string): Promise<OgMetadata | null> {
  if (ogCache.has(url)) return ogCache.get(url) ?? null;

  try {
    let html: string;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SMEMasterMail/1.0)",
        },
      });
      html = await response.text();
    } catch {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch");
      html = await response.text();
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const getMeta = (property: string): string | null => {
      const el = doc.querySelector(`meta[property="${property}"]`) ??
                 doc.querySelector(`meta[name="${property}"]`);
      return el?.getAttribute("content") ?? null;
    };

    const title = getMeta("og:title") ?? doc.querySelector("title")?.textContent ?? "";
    const description = getMeta("og:description") ?? getMeta("description") ?? "";
    const siteName = getMeta("og:site_name");
    const favicon = doc.querySelector('link[rel="icon"]')?.getAttribute("href") ??
                    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute("href") ??
                    null;

    let resolvedFavicon: string | null = null;
    if (favicon) {
      try {
        resolvedFavicon = new URL(favicon, url).href;
      } catch {
        resolvedFavicon = null;
      }
    }

    if (!resolvedFavicon) {
      try {
        const urlObj = new URL(url);
        resolvedFavicon = `${urlObj.origin}/favicon.ico`;
      } catch {
        resolvedFavicon = null;
      }
    }

    const metadata: OgMetadata = {
      title: title.trim(),
      description: description.trim().slice(0, 200),
      favicon: resolvedFavicon,
      url,
      siteName,
    };

    ogCache.set(url, metadata);
    return metadata;
  } catch {
    ogCache.set(url, null);
    return null;
  }
}

function LinkPreviewCard({ node }: NodeViewWrapperProps) {
  const url = node.attrs.url as string;
  const [metadata, setMetadata] = useState<OgMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchOgMetadata(url).then((data) => {
      if (!cancelled) {
        setMetadata(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <NodeViewWrapper>
        <div className="link-preview-card link-preview-loading" contentEditable={false}>
          <div className="link-preview-loading-bar" />
        </div>
      </NodeViewWrapper>
    );
  }

  if (!metadata) return <NodeViewWrapper><span /></NodeViewWrapper>;

  let domain = url;
  try {
    domain = new URL(url).hostname;
  } catch {
  }

  return (
    <NodeViewWrapper>
      <div className="link-preview-card" contentEditable={false}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-preview-content"
        >
          {metadata.favicon && (
            <img
              src={metadata.favicon}
              alt=""
              className="link-preview-favicon"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="link-preview-text">
            <span className="link-preview-title">{metadata.title || domain}</span>
            {metadata.description && (
              <span className="link-preview-description">{metadata.description}</span>
            )}
            <span className="link-preview-domain">
              <ExternalLink size={10} />
              {metadata.siteName || domain}
            </span>
          </div>
        </a>
      </div>
    </NodeViewWrapper>
  );
}

export const LinkPreviewExtension = TipTapNode.create({
  name: "linkPreview",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-link-preview]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-link-preview": "" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewCard);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("linkPreviewDetection"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (!text) return false;

            const urlPattern = /^https?:\/\/[^\s]+$/;
            const isUrl = urlPattern.test(text.trim());

            if (isUrl) {
              const url = text.trim();
              try {
                const urlObj = new URL(url);
                if (!urlObj.hostname.includes(".")) return false;
              } catch {
                return false;
              }

              event.preventDefault();

              const { from } = view.state.selection;
              const tr = view.state.tr.insertText(url + " ", from);

              const previewNode = view.state.schema.nodes.linkPreview?.create({ url });
              if (previewNode) {
                const afterUrl = from + url.length + 1;
                const paragraphAfter = view.state.schema.nodes.paragraph?.create();
                if (paragraphAfter) {
                  const nodesToInsert: ProseMirrorNode[] = [previewNode, paragraphAfter];
                  const insertTr = tr.insert(afterUrl, nodesToInsert);
                  view.dispatch(insertTr);
                } else {
                  const insertTr = tr.insert(afterUrl, previewNode);
                  view.dispatch(insertTr);
                }
              } else {
                view.dispatch(tr);
              }

              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

