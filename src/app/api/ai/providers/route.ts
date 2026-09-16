import { NextResponse } from "next/server";

import { listProviders } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/providers — which providers are configured.
 *
 * Credentials never leave the server: this returns only the model id, the
 * environment variable names to set, and whether the key is present.
 */
export async function GET() {
  const providers = listProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    model: provider.model,
    configured: provider.configured,
    priority: provider.priority,
    roles: provider.roles,
    envKeys: provider.envKeys,
    supportsGrounding: provider.supportsGrounding,
    note: provider.note,
  }));

  return NextResponse.json({
    providers,
    ready: providers.some((provider) => provider.configured),
  });
}
