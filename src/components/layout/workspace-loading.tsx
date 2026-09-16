import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** Route-level fallback: mirrors the header + metric + grid rhythm of a page. */
export function WorkspaceLoading() {
  return (
    <div className="shell-container flex flex-col gap-6 pt-10 pb-6 md:pt-12">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-28" />
            <SkeletonText lines={1} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-xl border border-line bg-surface p-5 xl:col-span-8">
          <Skeleton className="h-4 w-40" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3.5">
                <Skeleton className="size-16" />
                <div className="flex-1">
                  <SkeletonText lines={2} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 xl:col-span-4">
          <Skeleton className="h-4 w-28" />
          <div className="mt-5">
            <SkeletonText lines={6} />
          </div>
        </div>
      </div>
    </div>
  );
}
