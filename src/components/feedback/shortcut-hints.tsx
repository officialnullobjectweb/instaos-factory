"use client";

import { Modal } from "@/components/ui/modal";
import { NAV_ITEMS } from "@/lib/navigation";
import { QUEUE_SHORTCUTS, SHORTCUTS } from "@/lib/shortcuts";
import { useUIStore } from "@/store/ui-store";

function KeyChips({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key, index) =>
        key === "then key" ? (
          <span key={key} className="text-[12px] text-ink-3">
            then a page key
          </span>
        ) : (
          <kbd
            key={`${key}-${index}`}
            className="min-w-6 rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 text-center font-mono text-[11px] text-ink-2"
          >
            {key}
          </kbd>
        ),
      )}
    </span>
  );
}

export function ShortcutHintsDialog() {
  const open = useUIStore((state) => state.shortcutsOpen);
  const setOpen = useUIStore((state) => state.setShortcutsOpen);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      size="md"
      title="Keyboard shortcuts"
      description="Every action in Factory OS is reachable without the mouse."
    >
      <div className="flex flex-col gap-6 pb-2">
        <ul className="flex flex-col divide-y divide-line">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.id}
              className="flex items-center justify-between gap-6 py-2.5"
            >
              <span className="text-[13px] text-ink">{shortcut.label}</span>
              <KeyChips keys={shortcut.display} />
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            While reviewing the queue
          </h3>
          <ul className="flex flex-col divide-y divide-line">
            {QUEUE_SHORTCUTS.map((shortcut) => (
              <li
                key={shortcut.id}
                className="flex items-center justify-between gap-6 py-2.5"
              >
                <span className="text-[13px] text-ink">{shortcut.label}</span>
                <KeyChips keys={shortcut.display} />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            Go to
          </h3>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {NAV_ITEMS.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-[13px] text-ink-2"
              >
                <span>{item.label}</span>
                <KeyChips keys={["G", item.shortcutKey.toUpperCase()]} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
