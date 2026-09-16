"use client";

import { CircleCheck, Gauge, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusPill } from "@/components/content/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVICE_STATUS_META } from "@/lib/status";
import type { ServiceHealth } from "@/types";

/**
 * Live system health, measured by `GET /api/system/health`.
 *
 * Every row is a real probe: the storage driver's own health check and the
 * AI chain's actual success ratio from the request log. Nothing here is
 * declared — an unconfigured service renders as unconfigured.
 */
export function SystemHealth() {
  const [services, setServices] = useState<ServiceHealth[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { services?: ServiceHealth[] } | null) => {
        if (!cancelled && data?.services) setServices(data.services);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const degraded = (services ?? []).filter(
    (service) => service.status !== "operational",
  );
  const overall =
    services === null
      ? null
      : degraded.length === 0
        ? "operational"
        : "degraded";
  const meta = overall ? SERVICE_STATUS_META[overall] : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>System health</CardTitle>
          <p className="text-[13px] text-ink-2">
            {services === null
              ? "Measuring…"
              : degraded.length === 0
                ? "All services operational"
                : `${degraded.length} service needs attention`}
          </p>
        </div>
        {meta ? (
          <StatusPill tone={meta.tone} icon={meta.icon} label={meta.label} />
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        <ul className="flex flex-col divide-y divide-line">
          {(services ?? []).map((service) => {
            const statusMeta = SERVICE_STATUS_META[service.status];
            return (
              <li
                key={service.id}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Gauge className="size-4 shrink-0 text-ink-3" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {service.name}
                    </span>
                    <span className="truncate text-[11px] text-ink-3">
                      {service.description}
                    </span>
                  </span>
                </div>

                <span className="flex shrink-0 items-center gap-3 text-[12px] text-ink-2 tnum">
                  {service.latencyMs > 0 ? (
                    <span>{service.latencyMs} ms</span>
                  ) : null}
                  <StatusPill
                    tone={statusMeta.tone}
                    icon={statusMeta.icon}
                    label={statusMeta.label}
                    compact
                  />
                </span>
              </li>
            );
          })}
        </ul>

        {services !== null && services.length === 0 ? (
          <p className="flex items-center gap-2 text-[11.5px] text-ink-3">
            <CircleAlert className="size-3.5" />
            No services reported yet.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[11.5px] text-ink-3">
            <CircleCheck className="size-3.5" />
            Measured live — storage probe and AI request log, not declared status.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
