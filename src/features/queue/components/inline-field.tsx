"use client";

import { Check, CircleAlert, LoaderCircle, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAutosave } from "@/hooks/use-autosave";
import { cn } from "@/lib/utils";

interface InlineFieldProps {
  value: string;
  /** Persists the draft; the field handles debouncing and status. */
  onSave: (value: string) => Promise<unknown> | unknown;
  /**
   * Records a point-in-time version once an edit settles. Optional: fields that
   * do not belong in the version snapshot (e.g. a review note) omit it.
   */
  onCommit?: (value: string, summary: string) => void;
  /** Label used for the version summary, e.g. "Edited caption". */
  commitSummary?: string;
  label: string;
  placeholder?: string;
  /** Renders an auto-growing textarea instead of a single-line input. */
  multiline?: boolean;
  editable?: boolean;
  className?: string;
  /** Text style for both the resting value and the editor. */
  textClassName?: string;
  /** Shows a "Saving…/Saved" receipt next to the value. */
  showStatus?: boolean;
}

/**
 * Inline editable text.
 *
 * Resting state is plain type — no border, no input chrome — so a table of
 * these still reads like a document. Clicking swaps in a real input with the
 * value selected; `Enter` or blur commits, `Esc` restores the last saved value.
 */
export function InlineField({
  value,
  onSave,
  onCommit,
  commitSummary,
  label,
  placeholder = "Untitled",
  multiline = false,
  editable = true,
  className,
  textClassName,
  showStatus = true,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const autosave = useAutosave(value, { onSave });

  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const restoreRef = useRef(value);
  const skipCommitOnBlur = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.select();
  }, [editing]);

  function beginEditing() {
    if (!editable) return;
    restoreRef.current = autosave.value;
    setEditing(true);
  }

  function finishEditing() {
    setEditing(false);
    void autosave.flush();

    // A version is only worth recording when the text actually moved.
    if (onCommit && autosave.value !== restoreRef.current) {
      onCommit(autosave.value, commitSummary ?? `Edited ${label.toLowerCase()}`);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      skipCommitOnBlur.current = true;
      autosave.update(restoreRef.current);
      setEditing(false);
      return;
    }

    if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      finishEditing();
    }
  }

  if (editing) {
    const sharedClassName = cn(
      "w-full min-w-0 rounded-sm border border-ink/20 bg-surface px-1.5 py-1 text-ink outline-none",
      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink/15",
      textClassName,
    );

    return multiline ? (
      <textarea
        ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
        aria-label={label}
        value={autosave.value}
        rows={4}
        onChange={(event) => autosave.update(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={finishEditing}
        className={cn(sharedClassName, "field-sizing-content leading-relaxed")}
      />
    ) : (
      <input
        ref={fieldRef as React.RefObject<HTMLInputElement>}
        type="text"
        aria-label={label}
        value={autosave.value}
        onChange={(event) => autosave.update(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (skipCommitOnBlur.current) {
            skipCommitOnBlur.current = false;
            setEditing(false);
            return;
          }
          finishEditing();
        }}
        className={sharedClassName}
      />
    );
  }

  return (
    <span className={cn("group/inline flex min-w-0 items-center gap-2", className)}>
      <button
        type="button"
        onClick={beginEditing}
        disabled={!editable}
        title={editable ? `Edit ${label.toLowerCase()}` : undefined}
        className={cn(
          "min-w-0 rounded-sm text-left outline-none transition-colors duration-150 ease-soft",
          editable &&
            "-mx-1.5 cursor-text rounded-md px-1.5 py-1 hover:bg-surface-2 focus-visible:bg-surface-2",
          !editable && "cursor-default",
          textClassName,
        )}
      >
        {autosave.value ? (
          autosave.value
        ) : (
          <span className="text-ink-3">{placeholder}</span>
        )}
      </button>

      {editable ? (
        <Pencil
          aria-hidden="true"
          className="size-3 shrink-0 text-ink-3 opacity-0 transition-opacity duration-150 ease-soft group-hover/inline:opacity-100"
        />
      ) : null}

      {showStatus ? <AutosaveReceipt status={autosave.status} /> : null}
    </span>
  );
}

function AutosaveReceipt({ status }: { status: ReturnType<typeof useAutosave>["status"] }) {
  if (status === "idle") return null;

  const content = {
    dirty: { icon: Pencil, text: "Draft" },
    saving: { icon: LoaderCircle, text: "Saving" },
    saved: { icon: Check, text: "Saved" },
    error: { icon: CircleAlert, text: "Not saved" },
  }[status];

  const Icon = content.icon;

  return (
    <span
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-1 text-[11px]",
        status === "error" ? "text-danger" : "text-ink-3",
      )}
    >
      <Icon className={cn("size-3", status === "saving" && "animate-spin")} />
      <span className="hidden sm:inline">{content.text}</span>
    </span>
  );
}
