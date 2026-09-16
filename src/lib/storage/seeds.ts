/**
 * The committed fixture for each document, as a bundle-safe import.
 *
 * These files are the seed dataset: on a store that has nothing for a key, the
 * first read falls back to the fixture so a fresh deployment comes up with a
 * populated queue and analytics instead of a wall of empty states.
 *
 * They are **imported** rather than read from disk at runtime, and that is a
 * deliberate correction. The previous approach resolved
 * `path.join(process.cwd(), "data", key + ".json")`, which no build tool can
 * follow statically: the bundler cannot know which files a runtime-computed
 * path will touch, so the fixtures were not included in the deployed function
 * and every read failed with ENOENT in production while working perfectly in
 * development. A static import cannot be missed — if the file is not in the
 * bundle, the build fails, which is a far better place to find out.
 *
 * The imports are lazy so a route that only touches one document does not carry
 * every fixture: `insights.json` alone is a few hundred kilobytes.
 *
 * Keys with no fixture are absent on purpose. `instagram-history.json`, for
 * instance, is created by the first publish rather than shipped, so its absence
 * correctly reads as "nothing published yet".
 */

async function load(key: string): Promise<unknown> {
  switch (key) {
    case "posts":
      return (await import("@data/posts.json")).default;
    case "schedule":
      return (await import("@data/schedule.json")).default;
    case "audit":
      return (await import("@data/audit.json")).default;
    case "ai-logs":
      return (await import("@data/ai-logs.json")).default;
    case "telegram-log":
      return (await import("@data/telegram-log.json")).default;
    case "instagram-accounts":
      return (await import("@data/instagram-accounts.json")).default;
    case "experiments":
      return (await import("@data/experiments.json")).default;
    case "design-templates":
      return (await import("@data/design-templates.json")).default;
    case "learning":
      return (await import("@data/learning.json")).default;
    case "insights":
      return (await import("@data/insights.json")).default;
    default:
      // No fixture is not a failure: the document falls back to its empty
      // value, which is what "nothing has been written yet" means.
      return null;
  }
}

/** Every key that ships with a fixture, for the status endpoint and scripts. */
export async function seedKeys(): Promise<string[]> {
  return [
    "posts",
    "schedule",
    "audit",
    "ai-logs",
    "telegram-log",
    "instagram-accounts",
    "experiments",
    "design-templates",
    "learning",
    "insights",
  ];
}

export default load;
