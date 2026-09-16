/* -------------------------------------------------------------------------- */
/*  Instagram accounts (Graph API)                                            */
/* -------------------------------------------------------------------------- */

export type IgAccountStatus = "connected" | "token_expired" | "error";

export interface IgAccount {
  id: string;
  /** Human label, e.g. "Midnight Ritual". */
  label: string;
  /** The IG page handle, e.g. "@midnightritual". */
  handle: string;
  /** Instagram Business Account id used by the Graph API. */
  igUserId: string;
  /** Page id the IG account is linked to. */
  pageId: string;
  brandId: string;
  status: IgAccountStatus;
  /** ISO — when the access token was last refreshed. */
  tokenUpdatedAt: string;
  /** ISO — token expiry as reported by the API (long-lived ≈ 60 days). */
  tokenExpiresAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/** Client-safe account shape — never includes the token itself. */
export type IgAccountPublic = Omit<IgAccount, never>;

/* -------------------------------------------------------------------------- */
/*  Publishing                                                                */
/* -------------------------------------------------------------------------- */

export type IgMediaKind = "carousel" | "single" | "reel";

export type IgContainerStatus =
  | "creating"
  | "created"
  | "finished"
  | "error";

export interface IgContainerStep {
  at: string;
  detail: string;
  ok: boolean;
}

export interface IgPublishResult {
  ok: boolean;
  mediaId?: string;
  permalink?: string;
  error?: string;
  /** Machine-readable failure class used for retries and UI hints. */
  errorKind?: IgErrorKind;
  /** Wall-clock duration of the whole container → publish pipeline. */
  elapsedMs?: number;
  steps: IgContainerStep[];
}

export type IgErrorKind =
  | "expired_token"
  | "rate_limit"
  | "upload_failed"
  | "container_error"
  | "duplicate"
  | "network"
  | "unknown";

/* -------------------------------------------------------------------------- */
/*  Publish history                                                           */
/* -------------------------------------------------------------------------- */

export interface IgPublishRecord {
  id: string;
  postId: string;
  postTitle: string;
  accountId: string;
  igUserId: string;
  handle: string;
  brandId: string;
  mediaKind: IgMediaKind;
  /** The Graph API media id returned on publish. */
  mediaId: string;
  permalink: string;
  publishedAt: string;
  /** Container lifecycle duration in ms — surfaced in analytics. */
  elapsedMs: number;
  attempt: number;
}

export interface IgPublishSummary {
  total: number;
  last7Days: number;
  byAccount: { handle: string; count: number }[];
  lastPublishedAt: string | null;
}
