"use client";

import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import { exampleSetup } from "prosemirror-example-setup";
import {
  defaultMarkdownSerializer,
  MarkdownParser,
} from "prosemirror-markdown";
import type { MarkType, NodeType } from "prosemirror-model";
import { liftListItem, wrapInList } from "prosemirror-schema-list";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { memo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { documentSchema } from "@/lib/editor/config";
import { cn } from "@/lib/utils";

const noteMarkdownParser = new MarkdownParser(
  documentSchema,
  MarkdownIt("commonmark", { html: false }),
  {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    list_item: { block: "list_item" },
    bullet_list: { block: "bullet_list" },
    ordered_list: {
      block: "ordered_list",
      getAttrs: (tok) => ({ order: +(tok.attrGet("start") || 1) }),
    },
    heading: {
      block: "heading",
      getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
    },
    code_block: { block: "code_block", noCloseToken: true },
    fence: {
      block: "code_block",
      getAttrs: (tok) => ({ params: tok.info || "" }),
      noCloseToken: true,
    },
    hr: { node: "horizontal_rule" },
    image: {
      node: "image",
      getAttrs: (tok) => ({
        src: tok.attrGet("src"),
        title: tok.attrGet("title") || null,
        alt: tok.children?.at(0)?.content || null,
      }),
    },
    hardbreak: { node: "hard_break" },
    em: { mark: "em" },
    strong: { mark: "strong" },
    link: {
      mark: "link",
      getAttrs: (tok) => ({
        href: tok.attrGet("href"),
        title: tok.attrGet("title") || null,
      }),
    },
    code_inline: { mark: "code" },
  }
);

function parseMarkdown(content: string) {
  return (
    noteMarkdownParser.parse(content) ??
    documentSchema.node("doc", null, [documentSchema.node("paragraph")])
  );
}

function serializeMarkdown(doc: EditorView["state"]["doc"]) {
  return defaultMarkdownSerializer.serialize(doc);
}

type WysiwygNoteEditorProps = {
  content: string;
  onChange: (content: string) => void;
  onSwitchToMarkdown?: () => void;
  className?: string;
};

function isMarkActive(state: EditorState, type: MarkType) {
  const { from, $from, to, empty } = state.selection;
  if (empty) {
    return !!type.isInSet(state.storedMarks || $from.marks());
  }
  return state.doc.rangeHasMark(from, to, type);
}

function isBlockActive(
  state: EditorState,
  type: NodeType,
  attrs?: Record<string, unknown>
) {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type === type) {
      if (!attrs) {
        return true;
      }
      return Object.entries(attrs).every(
        ([key, val]) => node.attrs[key] === val
      );
    }
  }
  return false;
}

function toggleMark(view: EditorView, markType: MarkType) {
  const { state, dispatch } = view;
  const { from, to, empty } = state.selection;

  if (isMarkActive(state, markType)) {
    if (empty) {
      dispatch(state.tr.removeStoredMark(markType));
    } else {
      dispatch(state.tr.removeMark(from, to, markType));
    }
  } else if (empty) {
    dispatch(state.tr.addStoredMark(markType.create()));
  } else {
    dispatch(state.tr.addMark(from, to, markType.create()));
  }
  view.focus();
}

function setBlockType(
  view: EditorView,
  nodeType: NodeType,
  attrs?: Record<string, unknown>
) {
  const { state, dispatch } = view;
  const { $from, $to } = state.selection;

  const range = $from.blockRange($to);
  if (!range) {
    return;
  }

  const tr = state.tr;

  if (isBlockActive(state, nodeType, attrs)) {
    tr.setBlockType(range.start, range.end, documentSchema.nodes.paragraph);
  } else {
    tr.setBlockType(range.start, range.end, nodeType, attrs);
  }

  dispatch(tr);
  view.focus();
}

function toggleList(view: EditorView, listType: NodeType) {
  const { state, dispatch } = view;

  const isActive = isBlockActive(state, listType);

  if (isActive) {
    liftListItem(documentSchema.nodes.list_item)(state, dispatch);
  } else {
    wrapInList(listType)(state, dispatch);
  }

  view.focus();
}

function insertLink(view: EditorView) {
  const url = window.prompt("Enter URL:");
  if (!url) {
    return;
  }

  const { state, dispatch } = view;
  const { from, to, empty } = state.selection;
  const linkMark = documentSchema.marks.link;

  if (empty) {
    const linkText = window.prompt("Enter link text:", url) || url;
    const textNode = documentSchema.text(linkText, [
      linkMark.create({ href: url }),
    ]);
    dispatch(state.tr.insert(from, textNode));
  } else {
    dispatch(state.tr.addMark(from, to, linkMark.create({ href: url })));
  }

  view.focus();
}

type ToolbarButtonProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function ToolbarButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={cn("h-7 w-7", isActive && "bg-muted")}
          onClick={(e) => {
            e.preventDefault();
            onClick();
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function PureWysiwygNoteEditor({
  content,
  onChange,
  onSwitchToMarkdown,
  className,
}: WysiwygNoteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const contentRef = useRef(content);
  const suppressSync = useRef(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || editorRef.current) {
      return;
    }

    const doc = parseMarkdown(content);

    const state = EditorState.create({
      doc,
      plugins: [...exampleSetup({ schema: documentSchema, menuBar: false })],
    });

    const view = new EditorView(containerRef.current, {
      state,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);

        if (transaction.docChanged && !suppressSync.current) {
          const markdown = serializeMarkdown(newState.doc);
          contentRef.current = markdown;
          onChangeRef.current(markdown);
        }
      },
    });

    editorRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      editorRef.current = null;
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    const view = editorRef.current;
    if (!view) {
      return;
    }

    if (content === contentRef.current) {
      return;
    }
    contentRef.current = content;

    suppressSync.current = true;
    const newDoc = parseMarkdown(content);
    const tr = view.state.tr.replaceWith(
      0,
      view.state.doc.content.size,
      newDoc.content
    );
    view.dispatch(tr);
    suppressSync.current = false;
  }, [content]);

  const handleBold = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    toggleMark(editorRef.current, documentSchema.marks.strong);
  }, []);

  const handleItalic = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    toggleMark(editorRef.current, documentSchema.marks.em);
  }, []);

  const handleHeading1 = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    setBlockType(editorRef.current, documentSchema.nodes.heading, { level: 1 });
  }, []);

  const handleHeading2 = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    setBlockType(editorRef.current, documentSchema.nodes.heading, { level: 2 });
  }, []);

  const handleHeading3 = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    setBlockType(editorRef.current, documentSchema.nodes.heading, { level: 3 });
  }, []);

  const handleBulletList = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    toggleList(editorRef.current, documentSchema.nodes.bullet_list);
  }, []);

  const handleOrderedList = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    toggleList(editorRef.current, documentSchema.nodes.ordered_list);
  }, []);

  const handleLink = useCallback(() => {
    if (!editorRef.current) {
      return;
    }
    insertLink(editorRef.current);
  }, []);

  const getMarkActive = (markType: MarkType) => {
    if (!editorRef.current) {
      return false;
    }
    return isMarkActive(editorRef.current.state, markType);
  };

  const getBlockActive = (
    nodeType: NodeType,
    attrs?: Record<string, unknown>
  ) => {
    if (!editorRef.current) {
      return false;
    }
    return isBlockActive(editorRef.current.state, nodeType, attrs);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-0.5 border-border border-b bg-muted/30 px-2 py-1">
        <ToolbarButton
          icon={Bold}
          isActive={getMarkActive(documentSchema.marks.strong)}
          label="Bold"
          onClick={handleBold}
        />
        <ToolbarButton
          icon={Italic}
          isActive={getMarkActive(documentSchema.marks.em)}
          label="Italic"
          onClick={handleItalic}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          icon={Heading1}
          isActive={getBlockActive(documentSchema.nodes.heading, { level: 1 })}
          label="Heading 1"
          onClick={handleHeading1}
        />
        <ToolbarButton
          icon={Heading2}
          isActive={getBlockActive(documentSchema.nodes.heading, { level: 2 })}
          label="Heading 2"
          onClick={handleHeading2}
        />
        <ToolbarButton
          icon={Heading3}
          isActive={getBlockActive(documentSchema.nodes.heading, { level: 3 })}
          label="Heading 3"
          onClick={handleHeading3}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          icon={List}
          isActive={getBlockActive(documentSchema.nodes.bullet_list)}
          label="Bullet List"
          onClick={handleBulletList}
        />
        <ToolbarButton
          icon={ListOrdered}
          isActive={getBlockActive(documentSchema.nodes.ordered_list)}
          label="Numbered List"
          onClick={handleOrderedList}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          icon={Link}
          isActive={getMarkActive(documentSchema.marks.link)}
          label="Insert Link"
          onClick={handleLink}
        />
        {onSwitchToMarkdown && (
          <>
            <div className="flex-1" />
            <Button
              className="h-6 px-2 text-xs"
              onClick={onSwitchToMarkdown}
              size="sm"
              type="button"
              variant="ghost"
            >
              Use Markdown
            </Button>
          </>
        )}
      </div>
      <div
        className="prose prose-sm dark:prose-invert max-w-none flex-1 overflow-auto p-4"
        ref={containerRef}
        style={{ minHeight: "calc(100vh - 300px)" }}
      />
    </div>
  );
}

export const WysiwygNoteEditor = memo(
  PureWysiwygNoteEditor,
  (prev, next) =>
    prev.content === next.content &&
    prev.className === next.className &&
    prev.onSwitchToMarkdown === next.onSwitchToMarkdown
);
