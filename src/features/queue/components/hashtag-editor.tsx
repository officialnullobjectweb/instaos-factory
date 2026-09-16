"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HashtagEditorProps {
  hashtags: string[];
  onSave: (hashtags: string[]) => Promise<unknown> | unknown;
  /** Called once editing settles, so the change can be versioned. */
  onCommit?: (hashtags: string[], summary: string) => void;
  editable?: boolean;
  className?: string;
}

function normalise(raw: string) {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

/** Chips with an add field — hashtags are edited as a set, not as a string. */
export function HashtagEditor({
  hashtags,
  onSave,
  onCommit,
  editable = true,
  className,
}: HashtagEditorProps) {
  const [draft, setDraft] = useState("");

  /** Writes the draft, then records a version once the set has settled. */
  function persist(next: string[], summary: string) {
    void onSave(next);
    onCommit?.(next, summary);
  }

  function add() {
    const tag = normalise(draft);
    if (!tag) return;
    if (hashtags.includes(tag)) {
      setDraft("");
      return;
    }
    persist([...hashtags, tag], `Added ${tag}`);
    setDraft("");
  }

  function remove(tag: string) {
    persist(
      hashtags.filter((candidate) => candidate !== tag),
      `Removed ${tag}`,
    );
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <ul className="flex flex-wrap gap-1.5" aria-label="Hashtags">
        {hashtags.map((tag) => (
          <li key={tag}>
            <span className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pr-1 pl-2.5 text-[12px] text-ink">
              {tag}
              {editable ? (
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  aria-label={`Remove ${tag}`}
                  className="flex size-4 items-center justify-center rounded-full text-ink-3 outline-none transition-colors duration-150 ease-soft hover:bg-surface-3 hover:text-danger"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {editable ? (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                add();
              }
              if (event.key === "Backspace" && draft === "" && hashtags.length > 0) {
                remove(hashtags[hashtags.length - 1]);
              }
            }}
            onBlur={() => {
              if (draft.trim()) add();
            }}
            placeholder="Add a hashtag and press ↵"
            aria-label="Add a hashtag"
            className="h-8 max-w-64 text-[12.5px]"
          />
          <Button size="sm" variant="secondary" onClick={add} disabled={!draft.trim()}>
            <Plus />
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
