"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** Adds a required-ish note field and passes its value to `onConfirm`. */
  note?: {
    label: string;
    placeholder: string;
    defaultValue?: string;
    hint?: string;
  };
  onConfirm: (note: string) => void;
}

/**
 * One dialog for every action that cannot be undone by clicking again — delete,
 * reject, regenerate. Destructive confirmations always lead with the concrete
 * consequence rather than a generic "are you sure".
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "danger",
  note,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [value, setValue] = useState(note?.defaultValue ?? "");

  // Each opening starts clean: a cancelled note never leaks into the next post.
  useEffect(() => {
    if (open) setValue(note?.defaultValue ?? "");
  }, [open, note?.defaultValue]);

  function confirm() {
    onConfirm(value.trim() || note?.defaultValue || "");
    setValue(note?.defaultValue ?? "");
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={tone} size="sm" onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {note ? (
        <div className="flex flex-col gap-2 pb-2">
          <Label htmlFor="confirm-note">{note.label}</Label>
          <Textarea
            id="confirm-note"
            value={value}
            autoFocus
            placeholder={note.placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
          {note.hint ? (
            <p className="text-[12px] text-ink-3">{note.hint}</p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
