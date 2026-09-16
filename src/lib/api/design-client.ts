"use client";

import type {
  DesignDocument,
  QualityReport,
  SlideSpec,
  TemplateId,
} from "@/design/types";
import type { ExperimentDecision } from "@/lib/repositories/experiments-repository";
import type { SavedDesignTemplate } from "@/lib/repositories/design-templates-repository";

/**
 * Client transport for the design engine and the experiments ledger.
 * Same contract as the posts/AI clients: typed, one place to change transport,
 * errors that carry the server's explanation.
 */

export class DesignApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "DesignApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    throw new DesignApiError(
      payload?.error ?? `Request failed (${response.status})`,
      response.status,
      payload?.detail,
    );
  }
  return (await response.json()) as T;
}

/* ------------------------------ design render ----------------------------- */

export type ExportFormat = "png" | "pdf" | "zip";

/**
 * Triggers a browser download of the rendered document.
 *
 * A blob is deliberately used rather than a navigated URL: the render can take
 * a moment, so the UI shows progress, and a failed render becomes a caught
 * error instead of a useless navigation.
 */
export async function downloadExport(
  document_: Pick<DesignDocument, "templateId" | "overrides" | "slides">,
  format: ExportFormat,
  slideIndex?: number,
) {
  const response = await fetch("/api/design/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...document_, format, slideIndex }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    throw new DesignApiError(
      payload?.error ?? `Export failed (${response.status})`,
      response.status,
      payload?.detail,
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `export.${format}`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* --------------------------- saved templates ------------------------------ */

export const designApi = {
  templates: {
    list: () =>
      request<{ templates: SavedDesignTemplate[] }>("/api/design-templates"),
    create: (input: { name: string; description: string; document: DesignDocument }) =>
      request<{ template: SavedDesignTemplate }>("/api/design-templates", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (
      id: string,
      patch: Partial<{ name: string; description: string; document: DesignDocument }>,
    ) =>
      request<{ template: SavedDesignTemplate }>(`/api/design-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/api/design-templates/${id}`, { method: "DELETE" }),
  },
} as const;

/* ------------------------------- experiments ------------------------------ */

export interface ExperimentMetrics {
  reach: number;
  engagementRate: number;
  saves: number;
  follows: number;
}

export const experimentsApi = {
  list: () => request<{ decisions: ExperimentDecision[] }>("/api/experiments"),
  record: (input: {
    subNicheId: string;
    audienceId: string;
    winnerId: string;
    loserId: string;
    metrics: ExperimentMetrics;
    note: string;
  }) =>
    request<{ decision: ExperimentDecision }>("/api/experiments", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reset: () => request<{ ok: boolean; removed: number }>("/api/experiments", { method: "DELETE" }),
} as const;

export type { ExperimentDecision, QualityReport, SlideSpec, TemplateId };
