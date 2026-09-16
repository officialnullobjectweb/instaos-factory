"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { StatusPill } from "@/components/content/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { brands } from "@/data/brands";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/settings/components/settings-row";
import { formatCompact } from "@/lib/format";
import { BRAND_STATUS_META } from "@/lib/status";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function BrandsPanel() {
  return (
    <SettingsSection
      title="Connected brands"
      description="Each brand publishes through its own Instagram account and template set."
      footer={
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.info("Connect an account", {
              description: "OAuth handshake is disabled in the foundation build.",
            })
          }
        >
          Connect another account
        </Button>
      }
    >
      {brands.map((brand) => {
        const meta = BRAND_STATUS_META[brand.status];
        return (
          <SettingsRow
            key={brand.id}
            title={brand.name}
            description={`${brand.handle} · ${brand.positioning}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2.5">
                <Image
                  src={brand.logoSrc}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 rounded-sm border border-line"
                />
                <span className="flex flex-col text-[12px] text-ink-2">
                  <span className="tnum">
                    {formatCompact(brand.followers)} followers
                  </span>
                  <span className="tnum">{brand.postsThisWeek} posts / week</span>
                </span>
              </span>

              <StatusPill tone={meta.tone} icon={meta.icon} label={meta.label} />

              <Switch
                defaultChecked={brand.status === "active"}
                aria-label={`Publish to ${brand.name}`}
                onCheckedChange={(checked) =>
                  toast.success(
                    checked
                      ? `${brand.name} publishing enabled`
                      : `${brand.name} publishing paused`,
                  )
                }
              />

              <Button
                asChild
                variant="ghost"
                size="xs"
                className={cn("text-ink-2")}
              >
                <Link href="/analytics">
                  Insights
                  <ExternalLink />
                </Link>
              </Button>
            </div>
          </SettingsRow>
        );
      })}
    </SettingsSection>
  );
}
