"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { scaleIn } from "@/lib/motion";

interface BulkActionsProps {
  count: number;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
}

export function BulkActions({
  count,
  onApprove,
  onReject,
  onClear,
}: BulkActionsProps) {
  if (count === 0) return null;

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-6 z-20 mx-auto flex w-fit items-center gap-3 rounded-full border border-line bg-ink px-3 py-2 text-canvas shadow-pop"
    >
      <span className="pl-1.5 text-[13px] tnum">
        {count} selected
      </span>

      <span aria-hidden="true" className="h-4 w-px bg-canvas/20" />

      <Button
        size="xs"
        variant="subtle"
        className="bg-canvas text-ink hover:bg-canvas/90"
        onClick={onApprove}
      >
        <Check strokeWidth={2.4} />
        Approve
      </Button>

      <Button
        size="xs"
        variant="ghost"
        className="text-canvas hover:bg-canvas/10 hover:text-canvas"
        onClick={onReject}
      >
        <X />
        Request changes
      </Button>

      <Button
        size="xs"
        variant="ghost"
        className="text-canvas/70 hover:bg-canvas/10 hover:text-canvas"
        onClick={onClear}
      >
        Clear
      </Button>
    </motion.div>
  );
}
