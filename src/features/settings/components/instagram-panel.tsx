"use client";

import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  LoaderCircle,
  Plug,
  RefreshCw,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { useState } from "react";

import { InitialsAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { brands } from "@/data/brands";
import {
  SettingsRow,
  SettingsSection,
} from "@/features/settings/components/settings-row";
import { useInstagramAccounts } from "@/hooks/use-instagram";
import type { IgAccount } from "@/types";

const GRAPH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
];

interface FormState {
  label: string;
  handle: string;
  igUserId: string;
  pageId: string;
  brandId: string;
  accessToken: string;
}

const EMPTY_FORM: FormState = {
  label: "",
  handle: "",
  igUserId: "",
  pageId: "",
  brandId: brands[0]?.id ?? "",
  accessToken: "",
};

/** Days left on a long-lived token; null when the API did not report expiry. */
function tokenDaysLeft(account: IgAccount): number | null {
  if (!account.tokenExpiresAt) return null;
  const ms = new Date(account.tokenExpiresAt).getTime() - Date.now();
  return Math.floor(ms / 86_400_000);
}

function StatusBadge({ account }: { account: IgAccount }) {
  if (account.status === "connected") {
    return (
      <Badge tone="success">
        <CircleCheck />
        Connected
      </Badge>
    );
  }
  if (account.status === "token_expired") {
    return (
      <Badge tone="warning">
        <TriangleAlert />
        Token expired
      </Badge>
    );
  }
  return (
    <Badge tone="danger">
      <CircleAlert />
      Error
    </Badge>
  );
}

/**
 * The account manager.
 *
 * Two rules shape this panel: the access token goes up exactly once and is
 * never rendered back, and "connected" has to mean something — the token age
 * and expiry are on screen, with a refresh that actually calls the Graph API
 * rather than flipping a local flag.
 */
export function InstagramPanel() {
  const { accounts, loading, busyIds, connect, disconnect, refresh } =
    useInstagramAccounts();

  const [connectOpen, setConnectOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<IgAccount | null>(null);

  async function submit() {
    setSaving(true);
    const account = await connect({
      label: form.label.trim(),
      handle: form.handle.trim(),
      igUserId: form.igUserId.trim(),
      pageId: form.pageId.trim(),
      brandId: form.brandId,
      accessToken: form.accessToken.trim(),
    });
    setSaving(false);
    if (account) {
      setConnectOpen(false);
      setForm(EMPTY_FORM);
    }
  }

  const formValid =
    form.label.trim() !== "" &&
    form.handle.trim() !== "" &&
    form.igUserId.trim() !== "" &&
    form.pageId.trim() !== "" &&
    form.accessToken.trim().length >= 10;

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        title="Instagram pages"
        description="Every page publishes through the official Instagram Graph API. Tokens are stored server-side only and are never sent to the browser."
        footer={
          <>
            <a
              href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login"
              target="_blank"
              rel="noreferrer"
              className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] text-ink-2 transition-colors hover:text-ink"
            >
              <ExternalLink className="size-3.5" />
              Where to find these values
            </a>
            <Button size="sm" onClick={() => setConnectOpen(true)}>
              <Plug />
              Connect a page
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="flex flex-col gap-2 py-4">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2">
              <Plug className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-medium text-ink">
                No Instagram page connected
              </p>
              <p className="mx-auto max-w-sm text-[12.5px] leading-relaxed text-ink-2">
                Scheduled slots stay queued until a page is connected. Nothing
                publishes without one — approval alone never posts to Instagram.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConnectOpen(true)}
            >
              <Plug />
              Connect the first page
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {accounts.map((account) => {
              const busy = busyIds.includes(account.id);
              const days = tokenDaysLeft(account);
              const brand = brands.find((entry) => entry.id === account.brandId);

              return (
                <li key={account.id} className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <InitialsAvatar
                        initials={account.label
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((word) => word[0] ?? "")
                          .join("")
                          .toUpperCase()}
                        size="lg"
                        label={account.label}
                      />
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium text-ink">
                            {account.label}
                          </span>
                          <StatusBadge account={account} />
                        </div>
                        <span className="truncate font-mono text-[12px] text-ink-2">
                          {account.handle} · brand {brand?.name ?? account.brandId}
                        </span>
                        <span className="truncate font-mono text-[11px] text-ink-3 tnum">
                          ig-user {account.igUserId} · page {account.pageId}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void refresh(account.id)}
                      >
                        {busy ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <RefreshCw />
                        )}
                        Refresh token
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setPendingRemove(account)}
                      >
                        <Unplug />
                        Disconnect
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
                    <span className="text-[11.5px] text-ink-3">
                      Token refreshed{" "}
                      <span className="text-ink-2">
                        {new Date(account.tokenUpdatedAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="text-[11.5px] text-ink-3">
                      Expires{" "}
                      <span
                        className={
                          days !== null && days < 7 ? "text-warning" : "text-ink-2"
                        }
                      >
                        {account.tokenExpiresAt
                          ? `${new Date(account.tokenExpiresAt).toLocaleDateString()}${
                              days !== null ? ` (${days}d left)` : ""
                            }`
                          : "not reported"}
                      </span>
                    </span>
                    {account.lastError ? (
                      <span className="flex items-start gap-1.5 text-[11.5px] text-danger">
                        <CircleAlert className="mt-px size-3.5 shrink-0" />
                        {account.lastError}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection
        title="Publishing permissions"
        description="The app must hold these scopes before a container can be created. Publishing fails with a permission error, not a silent skip, if any are missing."
      >
        <div className="flex flex-wrap gap-1.5 py-4">
          {GRAPH_SCOPES.map((scope) => (
            <Badge key={scope} tone="outline" className="font-mono">
              {scope}
            </Badge>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Publishing behaviour"
        description="How the pipeline guards against double-posting and how long it waits."
      >
        <SettingsRow
          title="Duplicate publish prevention"
          description="A slot already carrying a media id is never published twice, so a re-run or a double click cannot post the same carousel again."
        >
          <Badge tone="neutral">Always on</Badge>
        </SettingsRow>
        <SettingsRow
          title="Container polling"
          description="Instagram processes media asynchronously. The pipeline polls the container every 5 seconds and gives up after 2 minutes."
        >
          <Badge tone="neutral" className="tnum">
            5s / 2min
          </Badge>
        </SettingsRow>
        <SettingsRow
          title="Retry policy"
          description="A failed publish retries up to 3 times, 15 minutes apart, storing the failure reason for each attempt."
        >
          <Badge tone="neutral" className="tnum">
            3 × 15min
          </Badge>
        </SettingsRow>
        <SettingsRow
          title="Metadata cleaning"
          description="Every slide is stripped of EXIF, XMP and text chunks before it leaves the server, and the cleaned PNGs are what Instagram fetches."
        >
          <Badge tone="neutral">Enabled</Badge>
        </SettingsRow>
      </SettingsSection>

      <Modal
        open={connectOpen}
        onOpenChange={setConnectOpen}
        title="Connect an Instagram page"
        description="Values come from your Meta app's Instagram API setup. The token is written to server storage and never returned."
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConnectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!formValid || saving}
              onClick={() => void submit()}
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Plug />}
              Connect page
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-label">Label</Label>
              <Input
                id="ig-label"
                placeholder="Midnight Ritual"
                value={form.label}
                onChange={(event) =>
                  setForm((current) => ({ ...current, label: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-handle">Handle</Label>
              <Input
                id="ig-handle"
                placeholder="@midnightritual"
                value={form.handle}
                onChange={(event) =>
                  setForm((current) => ({ ...current, handle: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-user">Instagram business account id</Label>
              <Input
                id="ig-user"
                inputMode="numeric"
                placeholder="17841400000000000"
                className="font-mono"
                value={form.igUserId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    igUserId: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-page">Linked Facebook page id</Label>
              <Input
                id="ig-page"
                inputMode="numeric"
                placeholder="102938475610293"
                className="font-mono"
                value={form.pageId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pageId: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ig-brand">Brand</Label>
            <Select
              value={form.brandId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, brandId: value }))
              }
            >
              <SelectTrigger id="ig-brand" className="w-full">
                <SelectValue placeholder="Choose a brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ig-token">Long-lived access token</Label>
            <Input
              id="ig-token"
              type="password"
              autoComplete="off"
              placeholder="EAAG…"
              className="font-mono"
              value={form.accessToken}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accessToken: event.target.value,
                }))
              }
            />
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              Store the long-lived token (≈60 days). Refresh it here before it
              expires — an expired token needs a full re-authorisation.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        size="sm"
        title="Disconnect this page?"
        description={
          pendingRemove
            ? `${pendingRemove.handle} will stop receiving scheduled posts and its stored token will be discarded.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingRemove(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                const target = pendingRemove;
                setPendingRemove(null);
                if (target) void disconnect(target.id);
              }}
            >
              <Unplug />
              Disconnect
            </Button>
          </>
        }
      />
    </div>
  );
}
