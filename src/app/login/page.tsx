"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-ink">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="size-6 text-canvas"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="18" cy="6" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
              Instagram Factory OS
            </h1>
            <p className="text-[13px] text-ink-2">
              Content automation for three brands
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-ink"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@factory.os"
              required
              className="h-10 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3 focus:border-ink/30 focus:outline-none focus:ring-1 focus:ring-ink/15"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-ink"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-10 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3 focus:border-ink/30 focus:outline-none focus:ring-1 focus:ring-ink/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-10 items-center justify-center rounded-lg bg-ink text-[14px] font-medium text-canvas transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 rounded-lg border border-line bg-surface-2 p-4">
          <p className="mb-2 text-[12px] font-medium text-ink-3 uppercase tracking-wider">
            Demo credentials
          </p>
          <div className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            <p>
              <span className="font-medium text-ink">Admin:</span>{" "}
              admin@factory.os / admin123
            </p>
            <p>
              <span className="font-medium text-ink">Editor:</span>{" "}
              editor@factory.os / editor123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
