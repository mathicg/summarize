import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readTweetWithPreferredClient } from "../src/run/bird.js";
import { resolveExecutableInPath } from "../src/run/env.js";

const ENV = process.env as Record<string, string | undefined>;
const XURL_PATH = resolveExecutableInPath("xurl", ENV);
const LIVE = process.env.SUMMARIZE_LIVE_TESTS === "1" && Boolean(XURL_PATH);

function readJson<T>(endpoint: string): T {
  const stdout = execFileSync("xurl", [endpoint], {
    env: ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(stdout) as T;
}

function resolveLiveTweetUrl(): string {
  const me = readJson<{ data?: { id?: string; username?: string } }>("/2/users/me");
  const userId = me.data?.id;
  const username = me.data?.username;
  if (!userId || !username) {
    throw new Error("xurl live test could not resolve /2/users/me");
  }

  const tweets = readJson<{ data?: Array<{ id?: string }> }>(
    `/2/users/${userId}/tweets?max_results=5&exclude=retweets,replies`,
  );
  const tweetId = tweets.data?.find((tweet) => typeof tweet.id === "string" && tweet.id)?.id;
  if (!tweetId) {
    throw new Error("xurl live test could not find a recent tweet");
  }
  return `https://x.com/${username}/status/${tweetId}`;
}

describe("live xurl tweet reader", () => {
  const run = LIVE ? it : it.skip;

  run(
    "prefers xurl for tweet extraction when it is installed and authenticated",
    async () => {
      const tweetUrl = resolveLiveTweetUrl();
      const result = await readTweetWithPreferredClient({
        url: tweetUrl,
        timeoutMs: 120_000,
        env: ENV,
      });

      expect(result.client).toBe("xurl");
      expect(result.text.trim().length).toBeGreaterThan(10);
    },
    180_000,
  );
});
