"use client";

import { CircleUser, Keyboard, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";

import { InitialsAvatar } from "@/components/ui/avatar";
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
import { useUIStore } from "@/store/ui-store";

export const CURRENT_USER = {
  name: "Kamal Dhiver",
  role: "Owner",
  email: "kamal@factory.os",
  initials: "KD",
};

/** First name only — greetings read better without the surname. */
export const CURRENT_USER_FIRST_NAME = CURRENT_USER.name.split(" ")[0];

export function UserMenu() {
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={`Account menu for ${CURRENT_USER.name}`}
        >
          <InitialsAvatar
            initials={CURRENT_USER.initials}
            size="sm"
            tone="ink"
            className="border-0"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>Signed in</DropdownMenuLabel>
        <div className="flex items-center gap-2.5 px-2.5 pb-2">
          <InitialsAvatar initials={CURRENT_USER.initials} size="md" tone="ink" className="border-0" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium">
              {CURRENT_USER.name}
            </span>
            <span className="truncate text-[11px] text-ink-3">
              {CURRENT_USER.email}
            </span>
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserRound />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Workspace settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
          <Keyboard />
          Keyboard shortcuts
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="danger"
          onSelect={() =>
            toast.info("Sign out is disabled in this prototype", {
              description: "Authentication arrives with the Instagram integration.",
            })
          }
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CurrentUserChip() {
  return (
    <span className="flex items-center gap-2 text-[13px] text-ink-2">
      <CircleUser className="size-4" />
      {CURRENT_USER.name}
    </span>
  );
}
