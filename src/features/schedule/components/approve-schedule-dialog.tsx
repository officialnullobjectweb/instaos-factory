"use client";

import { AtSign } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrand } from "@/data/brands";
import { useSchedule } from "@/hooks/use-schedule";
import { usePostsStore } from "@/store/posts-store";
import { cn } from "@/lib/utils";
import type { Post } from "@/types";

/**
 * The approval flow, materialised: the reviewer picks *when* and *where*, the
 * post leaves the queue and the publishing queue takes over from there.
 *
 * `MOCK_NOW` anchors the presets so the demo clock and the offered slots stay
 * consistent; the API still rejects times in the real past.
 */

interface QuickSlot {
  label: string;
  hoursAhead: number;
  minute: number;
}

const QUICK_SLOTS: QuickSlot[] = [
  { label: "Today 18:30", hoursAhead: 4, minute: 30 },
  { label: "Tomorrow 09:00", hoursAhead: 20, minute: 0 },
  { label: "Tomorrow 18:30", hoursAhead: 28, minute: 30 },
];

function isoFor(base: Date, hoursAhead: number, minute: number) {
  const date = new Date(base);
  date.setHours(date.getHours() + hoursAhead, minute, 0, 0);
  return date.toISOString();
}

/** `YYYY-MM-DDTHH:mm` in local time for the datetime-local input. */
function localInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface ApproveScheduleDialogProps {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected posting time (from a drag-drop target), if any. */
  initialTime?: string | null;
}

export function ApproveScheduleDialog({
  post,
  open,
  onOpenChange,
  initialTime,
}: ApproveScheduleDialogProps) {
  const { book } = useSchedule();
  const refresh = usePostsStore((state) => state.refresh);

  const [timeValue, setTimeValue] = useState("");
  const [igPage, setIgPage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const brand = useMemo(() => (post ? getBrand(post.brandId) : null), [post]);

  // Re-seed the form each time the dialog opens for a new post.
  useEffect(() => {
    if (!open || !post) return;
    const base = new Date();
    setTimeValue(
      initialTime
        ? localInputValue(initialTime)
        : localInputValue(isoFor(base, 4, 30)),
    );
    setIgPage(brand?.handle ?? "");
  }, [open, post, initialTime, brand]);

  const presetBase = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!post || !timeValue) return;
    setSubmitting(true);
    const entry = await book({
      postId: post.id,
      scheduledFor: new Date(timeValue).toISOString(),
      igPage,
    });
    setSubmitting(false);

    if (entry) {
      await refresh();
      onOpenChange(false);
    }
  };

  if (!post) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule post"
      description={`"${post.title}" — choose when it goes live and on which page.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || !timeValue}>
            {submitting ? "Booking…" : "Confirm slot"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-medium text-ink">Quick slots</legend>
          <div className="flex flex-wrap gap-2">
            {QUICK_SLOTS.map((slot) => {
              const iso = isoFor(presetBase, slot.hoursAhead, slot.minute);
              const active =
                timeValue === localInputValue(iso);
              return (
                <Button
                  key={slot.label}
                  size="sm"
                  variant={active ? "primary" : "secondary"}
                  onClick={() => setTimeValue(localInputValue(iso))}
                >
                  {slot.label}
                </Button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="schedule-time"
            className="text-[13px] font-medium text-ink"
          >
            Posting time
          </label>
          {/* Deliberately the platform datetime control: the value is a real
              wall-clock time, and our custom pickers cover date-only fields. */}
          <Input
            id="schedule-time"
            type="datetime-local"
            value={timeValue}
            onChange={(event) => setTimeValue(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="schedule-page" className="text-[13px] font-medium text-ink">
            Instagram page
          </label>
          <div className="flex flex-wrap gap-2">
            {[brand?.handle, "@midnightritual", "@studionoir", "@thedailygrind"]
              .filter((handle, index, all) => handle && all.indexOf(handle) === index)
              .map((handle) => (
                <button
                  key={handle}
                  type="button"
                  onClick={() => setIgPage(handle ?? "")}
                  aria-pressed={igPage === handle}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ease-soft",
                    igPage === handle
                      ? "border-ink bg-ink text-canvas"
                      : "border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <AtSign className="size-3.5" />
                  {handle}
                </button>
              ))}
          </div>
          <Input
            id="schedule-page"
            value={igPage}
            onChange={(event) => setIgPage(event.target.value)}
            placeholder="@handle"
            className="mt-1 max-w-64"
            aria-label="Custom Instagram handle"
          />
        </div>

        <p className="text-[12.5px] text-ink-2">
          The slot enters the publishing queue and fires automatically — no post
          publishes without this approval step.
        </p>
      </div>
    </Modal>
  );
}
