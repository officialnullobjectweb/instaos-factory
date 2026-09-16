import { randomUUID } from "node:crypto";

import { arrayDocument } from "@/lib/storage";
import type { DesignDocument } from "@/design/types";

/**
 * Saved design templates — the reusable presets of the studio.
 *
 * A template wraps a whole `DesignDocument`, so a row that has lost it cannot
 * be opened in the editor and would fail on load. Those rows are dropped at the
 * boundary.
 */

export interface SavedDesignTemplate {
  id: string;
  name: string;
  description: string;
  document: DesignDocument;
  createdAt: string;
  updatedAt: string;
}

function isSavedDesignTemplate(raw: unknown): raw is SavedDesignTemplate {
  if (typeof raw !== "object" || raw === null) return false;
  const entry = raw as Partial<SavedDesignTemplate>;

  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.document === "object" &&
    entry.document !== null &&
    Array.isArray(entry.document.slides) &&
    typeof entry.document.templateId === "string"
  );
}

const templates = () =>
  arrayDocument<SavedDesignTemplate>({
    key: "design-templates",
    isItem: isSavedDesignTemplate,
  });

export async function listDesignTemplates(): Promise<SavedDesignTemplate[]> {
  return templates().read();
}

export async function getDesignTemplate(
  id: string,
): Promise<SavedDesignTemplate | null> {
  const entries = await templates().read();
  return entries.find((entry) => entry.id === id) ?? null;
}

export async function createDesignTemplate(input: {
  name: string;
  description: string;
  document: DesignDocument;
}): Promise<SavedDesignTemplate> {
  const now = new Date().toISOString();
  const entry: SavedDesignTemplate = {
    id: `dtpl-${randomUUID().slice(0, 8)}`,
    name: input.name,
    description: input.description,
    document: input.document,
    createdAt: now,
    updatedAt: now,
  };

  await templates().prepend(entry);
  return entry;
}

export async function updateDesignTemplate(
  id: string,
  patch: Partial<Pick<SavedDesignTemplate, "name" | "description" | "document">>,
): Promise<SavedDesignTemplate | null> {
  return templates().mutate((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) return current;

    const next = [...current];
    next[index] = {
      ...next[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return next;
  }).then((updated) => updated.find((entry) => entry.id === id) ?? null);
}

export async function deleteDesignTemplate(id: string): Promise<boolean> {
  const before = await templates().read();
  if (!before.some((entry) => entry.id === id)) return false;

  await templates().mutate((current) =>
    current.filter((entry) => entry.id !== id),
  );
  return true;
}
