"use client";

import { useCallback, useEffect, useState } from "react";

import {
  connectInstagramAccount,
  disconnectInstagramAccount,
  fetchInstagramAccounts,
  fetchPublishHistory,
  refreshInstagramToken,
  type ConnectAccountInput,
  type PublishHistoryPayload,
} from "@/lib/api/instagram-client";
import { toast } from "@/lib/toast";
import type { IgAccount } from "@/types";

/**
 * Account manager + publish history for the Instagram integration.
 *
 * Accounts are loaded once and mutated locally after each confirmed call, so
 * the UI never has to refetch to stay consistent.
 */
export function useInstagramAccounts() {
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setAccounts(await fetchInstagramAccounts());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load accounts",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((current) =>
      busy
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );

  const connect = useCallback(async (input: ConnectAccountInput) => {
    try {
      const account = await connectInstagramAccount(input);
      setAccounts((current) => {
        const index = current.findIndex((item) => item.id === account.id);
        if (index === -1) return [...current, account];
        return current.map((item) => (item.id === account.id ? account : item));
      });
      toast.success("Account connected", {
        description: `${account.handle} is ready to publish.`,
      });
      return account;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not connect account",
      );
      return null;
    }
  }, []);

  const disconnect = useCallback(
    async (id: string) => {
      markBusy(id, true);
      try {
        await disconnectInstagramAccount(id);
        setAccounts((current) => current.filter((item) => item.id !== id));
        toast.success("Account disconnected", {
          description: "Its stored token has been discarded.",
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not disconnect",
        );
      } finally {
        markBusy(id, false);
      }
    },
    [],
  );

  const refresh = useCallback(async (id: string) => {
    markBusy(id, true);
    try {
      const { expiresAt } = await refreshInstagramToken(id);
      setAccounts((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "connected",
                lastError: null,
                tokenUpdatedAt: new Date().toISOString(),
                tokenExpiresAt: expiresAt,
              }
            : item,
        ),
      );
      toast.success("Token refreshed", {
        description: expiresAt
          ? `Valid until ${new Date(expiresAt).toLocaleDateString()}.`
          : "A new long-lived token is stored.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not refresh token";
      setAccounts((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status: "token_expired", lastError: message }
            : item,
        ),
      );
      toast.error("Refresh failed", { description: message });
    } finally {
      markBusy(id, false);
    }
  }, []);

  return {
    accounts,
    loading,
    busyIds,
    connect,
    disconnect,
    refresh,
    reload: load,
  };
}

export type InstagramAccountsController = ReturnType<
  typeof useInstagramAccounts
>;

/** Publish history + rollup numbers for the Analytics surface. */
export function usePublishHistory(limit = 50) {
  const [data, setData] = useState<PublishHistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await fetchPublishHistory(limit));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load publish history",
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, reload: load };
}
