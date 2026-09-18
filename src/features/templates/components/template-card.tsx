"use client";

import { Eye, LayoutTemplate } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { MOCK_NOW } from "@/data/time";
import { useDisclosure } from "@/hooks/use-disclosure";
import { formatRelativeTime } from "@/lib/format";
import { FORMAT_LABELS } from "@/lib/status";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Template } from "@/types";

interface TemplateCardProps {
  template: Template;
  className?: string;
}

export function TemplateCard({ template, className }: TemplateCardProps) {
  const { open: previewOpen, setOpen: setPreviewOpen } = useDisclosure();

  return (
    <>
      <Card className={cn("group gap-0 overflow-hidden transition-shadow hover:shadow-card", className)}>
        {/* Visual preview */}
        <div className="relative flex aspect-[4/3] flex-col justify-between border-b border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-[0.1em] text-ink-3 uppercase">
              {FORMAT_LABELS[template.format]}
            </span>
            <Badge tone={template.status === "live" ? "success" : "neutral"} size="sm">
              {template.status === "live" ? "Live" : "Draft"}
            </Badge>
          </div>

          <div className="flex flex-col gap-1">
            {template.preview.map((line, index) => (
              <span
                key={line}
                className={cn(
                  "text-ink",
                  index === 0
                    ? "font-mono text-[9px] tracking-[0.12em] text-ink-3 uppercase"
                    : index === 1
                      ? "text-[14px] leading-tight font-medium"
                      : "text-[12px] leading-snug text-ink-2",
                )}
              >
                {line}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-3">
              {template.brandIds.length} {template.brandIds.length === 1 ? "brand" : "brands"}
            </span>
            <span className="text-[10px] text-ink-3">·</span>
            <span className="text-[10px] text-ink-3">{template.uses} uses</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="text-[14px] font-medium tracking-[-0.01em]">
            {template.name}
          </h3>
          <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-2">
            {template.description}
          </p>
          <span className="font-mono text-[10px] text-ink-3">
            {template.category} · {formatRelativeTime(template.updatedAt, MOCK_NOW)}
          </span>
        </div>

        <CardFooter className="pt-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye />
            Preview
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              toast.success(`${template.name} applied`, {
                description: "New draft added to queue.",
              })
            }
          >
            <LayoutTemplate />
            Use
          </Button>
        </CardFooter>
      </Card>

      <Modal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={template.name}
        description={`${template.category} · ${FORMAT_LABELS[template.format]}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setPreviewOpen(false);
                toast.success(`${template.name} applied`);
              }}
            >
              Use template
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <div className="flex aspect-[4/3] flex-col justify-center gap-2 rounded-lg border border-line bg-surface-2 p-6">
            {template.preview.map((line, index) => (
              <span
                key={line}
                className={cn(
                  index === 0
                    ? "font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase"
                    : index === 1
                      ? "text-[18px] leading-tight font-medium"
                      : "text-[14px] leading-snug text-ink-2",
                )}
              >
                {line}
              </span>
            ))}
          </div>
          <p className="text-[13px] leading-relaxed text-ink-2">
            {template.description}
          </p>
        </div>
      </Modal>
    </>
  );
}
