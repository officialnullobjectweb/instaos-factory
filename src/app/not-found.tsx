import Link from "next/link";

import { FactoryMark } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 px-6 text-center">
      <FactoryMark className="size-10" />

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[11px] tracking-[0.14em] text-ink-3 uppercase">
          404
        </p>
        <h1 className="text-[26px] font-medium tracking-[-0.02em]">
          This page does not exist
        </h1>
        <p className="max-w-sm text-[14px] leading-relaxed text-ink-2">
          The route you asked for is not part of the workspace. Head back to the
          dashboard to pick up where you left off.
        </p>
      </div>

      <Button asChild variant="primary">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </main>
  );
}
