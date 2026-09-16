"use client";

import {
  ArrowUpRight,
  Check,
  Copy,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  TextCursorInput,
  Trash,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import { isReviewable } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Post } from "@/types";

interface PostActionsProps {
  post: Post;
  onOpen?: (post: Post) => void;
  onApprove?: (post: Post) => void;
  onReject?: (post: Post) => void;
  onEditCaption?: (post: Post) => void;
  onEditCarousel?: (post: Post) => void;
  onRegenerate?: (post: Post, target: "caption" | "carousel") => void;
  onDuplicate?: (post: Post) => void;
  onDelete?: (post: Post) => void;
  /** Replaces the default trigger, e.g. an inline "Actions" button. */
  trigger?: ReactNode;
  align?: "start" | "end";
  className?: string;
}

/** Every lifecycle action in one menu, shared by the table, the cards and the drawer. */
export function PostActions({
  post,
  onOpen,
  onApprove,
  onReject,
  onEditCaption,
  onEditCarousel,
  onRegenerate,
  onDuplicate,
  onDelete,
  trigger,
  align = "end",
  className,
}: PostActionsProps) {
  const reviewable = isReviewable(post.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${post.title}`}
            className={className}
          >
            <MoreHorizontal />
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel className="font-mono">{post.id}</DropdownMenuLabel>

        {onOpen ? (
          <DropdownMenuItem onSelect={() => onOpen(post)}>
            <ArrowUpRight />
            Open review drawer
          </DropdownMenuItem>
        ) : null}

        {reviewable && onApprove ? (
          <DropdownMenuItem onSelect={() => onApprove(post)}>
            <Check />
            Approve
            <DropdownMenuShortcut>A</DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : null}

        {reviewable && onReject ? (
          <DropdownMenuItem onSelect={() => onReject(post)}>
            <X />
            Reject with a note
            <DropdownMenuShortcut>R</DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        {onRegenerate ? (
          <>
            <DropdownMenuItem onSelect={() => onRegenerate(post, "caption")}>
              <RefreshCw />
              Regenerate caption
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRegenerate(post, "carousel")}>
              <ImagePlus />
              Regenerate carousel
            </DropdownMenuItem>
          </>
        ) : null}

        {onEditCaption ? (
          <DropdownMenuItem onSelect={() => onEditCaption(post)}>
            <TextCursorInput />
            Edit caption
          </DropdownMenuItem>
        ) : null}

        {onEditCarousel ? (
          <DropdownMenuItem onSelect={() => onEditCarousel(post)}>
            <Pencil />
            Edit slides
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        {onDuplicate ? (
          <DropdownMenuItem onSelect={() => onDuplicate(post)}>
            <Copy />
            Duplicate post
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void navigator.clipboard?.writeText(post.id);
            toast.success("Post ID copied", { description: post.id });
          }}
        >
          <Copy />
          Copy post ID
        </DropdownMenuItem>

        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" onSelect={() => onDelete(post)}>
              <Trash />
              Delete post
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact approve / reject pair that appears on row hover. */
export function QuickDecision({
  post,
  onApprove,
  onReject,
  className,
}: {
  post: Post;
  onApprove: (post: Post) => void;
  onReject: (post: Post) => void;
  className?: string;
}) {
  if (!isReviewable(post.status)) return null;

  return (
    <span className={cn("flex items-center gap-1", className)}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Approve ${post.title}`}
        onClick={() => onApprove(post)}
        className="text-ink-2 hover:text-success"
      >
        <Check />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Reject ${post.title}`}
        onClick={() => onReject(post)}
        className="text-ink-2 hover:text-danger"
      >
        <X />
      </Button>
    </span>
  );
}
