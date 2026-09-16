"use client";

import { Command } from "cmdk";
import { CornerDownLeft, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { brands } from "@/data/brands";
import { useAllPosts } from "@/hooks/use-posts";
import { COMMAND_ACTIONS, NAV_ITEMS } from "@/lib/navigation";
import { CONTENT_STATUS_META } from "@/lib/status";
import { toast } from "@/lib/toast";
import { useBrandScope } from "@/hooks/use-scope";
import { useUIStore } from "@/store/ui-store";

const ITEM_CLASS =
  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-ink outline-none select-none transition-colors duration-150 ease-soft data-[selected=true]:bg-surface-2";

export function CommandPalette() {
  const router = useRouter();
  const open = useUIStore((state) => state.commandOpen);
  const setOpen = useUIStore((state) => state.setCommandOpen);
  const items = useAllPosts();
  const { setBrandId } = useBrandScope();
  const setGenerateOpen = useUIStore((state) => state.setGenerateOpen);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        // Keyboard-driven surface: it must be there the moment ⌘K lands, so the
        // panel skips the scale-in and only the scrim fades.
        className="top-[12%] max-w-xl translate-y-0 overflow-hidden p-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
      >
        <DialogTitle className="sr-only">Search and run commands</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, brands, content items and quick actions.
        </DialogDescription>

        <Command
          label="Command search"
          loop
          className="flex flex-col"
          value={query}
          onValueChange={setQuery}
        >
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search className="size-4 shrink-0 text-ink-3" />
            <Command.Input
              autoFocus
              placeholder="Search pages, brands, content or run a command…"
              className="h-13 flex-1 bg-transparent py-4 text-[14px] text-ink outline-none placeholder:text-ink-3"
            />
            <kbd className="hidden shrink-0 rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3 sm:block">
              ESC
            </kbd>
          </div>

          <Command.List className="scrollbar-slim max-h-[22rem] overflow-y-auto overscroll-contain p-2">
            <Command.Empty className="px-3 py-10 text-center text-[13px] text-ink-2">
              No results for “{query}”.
            </Command.Empty>

            <Command.Group
              heading="Navigate"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => go(item.href)}
                    className={ITEM_CLASS}
                  >
                    <Icon className="size-4 shrink-0 text-ink-2" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{item.label}</span>
                      <span className="truncate text-[11px] text-ink-3">
                        {item.description}
                      </span>
                    </span>
                    <kbd className="ml-auto font-mono text-[10px] text-ink-3">
                      G {item.shortcutKey.toUpperCase()}
                    </kbd>
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group
              heading="Brands"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase"
            >
              {brands.map((brand) => (
                <Command.Item
                  key={brand.id}
                  value={`${brand.name} ${brand.handle} ${brand.positioning}`}
                  onSelect={() => {
                    setBrandId(brand.id);
                    go("/queue");
                  }}
                  className={ITEM_CLASS}
                >
                  <Image
                    src={brand.logoSrc}
                    alt=""
                    width={16}
                    height={16}
                    className="size-4 rounded-xs"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{brand.name}</span>
                    <span className="truncate text-[11px] text-ink-3">
                      {brand.positioning}
                    </span>
                  </span>
                  <span className="ml-auto text-[11px] text-ink-3">
                    Scope queue
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Content"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase"
            >
              {items.slice(0, 8).map((item) => {
                const meta = CONTENT_STATUS_META[item.status];
                const Icon = meta.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.tags.join(" ")} ${item.id}`}
                    onSelect={() => go(`/queue?item=${item.id}`)}
                    className={ITEM_CLASS}
                  >
                    <Icon className="size-4 shrink-0 text-ink-2" />
                    <span className="truncate">{item.title}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px] text-ink-3">
                      <span className="font-mono">{item.id}</span>
                      <span>{meta.label}</span>
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase"
            >
              {COMMAND_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Command.Item
                    key={action.id}
                    value={`${action.label} ${action.keywords.join(" ")}`}
                    onSelect={() => {
                      if (action.href) {
                        go(action.href);
                        return;
                      }
                      if (action.command === "generate") {
                        setOpen(false);
                        setGenerateOpen(true);
                        return;
                      }
                      setOpen(false);
                      toast.success(action.label, {
                        description:
                          "This action is a placeholder until the automation layer lands.",
                      });
                    }}
                    className={ITEM_CLASS}
                  >
                    <Icon className="size-4 shrink-0 text-ink-2" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{action.label}</span>
                      <span className="truncate text-[11px] text-ink-3">
                        {action.description}
                      </span>
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>

          <footer className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-xs border border-line bg-surface-2 px-1 font-mono">
                ↑
              </kbd>
              <kbd className="rounded-xs border border-line bg-surface-2 px-1 font-mono">
                ↓
              </kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded-xs border border-line bg-surface-2 px-1 font-mono">
                <CornerDownLeft className="inline size-3" />
              </kbd>
              to select
            </span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
