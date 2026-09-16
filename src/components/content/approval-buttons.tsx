"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";

interface ApprovalButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  onApprove: () => void;
  pending?: boolean;
  label?: string;
}

export function ApprovalButton({
  onApprove,
  pending = false,
  label = "Approve",
  ...props
}: ApprovalButtonProps) {
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onApprove}
      disabled={pending}
      aria-label={`${label} content`}
      {...props}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <Check strokeWidth={2.4} />
      )}
      {label}
    </Button>
  );
}

interface RejectButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  onReject: (note: string) => void;
  itemTitle: string;
  label?: string;
}

export function RejectButton({
  onReject,
  itemTitle,
  label = "Reject",
  ...props
}: RejectButtonProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  function confirm() {
    onReject(note.trim() || "No further detail provided.");
    setNote("");
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`${label} for ${itemTitle}`}
        {...props}
      >
        <X />
        {label}
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Reject this post?"
        description={itemTitle}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirm}>
              Reject post
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 pb-2">
          <Label htmlFor="reject-note">Why is it being rejected?</Label>
          <Textarea
            id="reject-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Tighten the opening hook and cite the claim on slide 3."
            autoFocus
          />
          <p className="text-[12px] text-ink-3">
            The note stays on the post and is visible to whoever revises it.
          </p>
        </div>
      </Modal>
    </>
  );
}
