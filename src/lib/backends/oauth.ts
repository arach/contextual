// OAuth credential manager for pi-ai-backed providers (Claude Pro/Max, etc.)
//
// Storage: ~/.contextual/credentials.json — chmod 600, one entry per provider.
// We deliberately do NOT share with ~/.pi/agent/auth.json (pi-coding-agent's
// store) to keep Contextual self-contained.
//
// The flow:
//   1. /api/oauth/login?provider=anthropic kicks off loginAnthropic; pi-ai
//      opens its own localhost callback server and gives us an authorize URL
//      via onAuth.
//   2. We open the URL in the user's default browser.
//   3. User authenticates with Anthropic; their browser redirects to pi-ai's
//      callback server; loginAnthropic resolves with credentials.
//   4. We persist credentials and respond OK to the original request.
//
// On dispatch we read credentials, refresh if near expiry, and pass the
// resulting access token as `apiKey` to the pi-ai stream function.

import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { OAuthCredentials, OAuthPrompt } from "@earendil-works/pi-ai";
import { getOAuthProvider, loginAnthropic } from "@earendil-works/pi-ai/oauth";

const ROOT = path.join(os.homedir(), ".contextual");
const CREDS_FILE = path.join(ROOT, "credentials.json");

// Refresh slightly before the token's hard expiry to avoid spurious 401s.
const REFRESH_LEAD_MS = 60_000;

interface Store {
  providers: Record<string, OAuthCredentials>;
}

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await fs.readFile(CREDS_FILE, "utf8")) as Store;
  } catch {
    return { providers: {} };
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(CREDS_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open '${url.replace(/'/g, "'\\''")}'`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open '${url.replace(/'/g, "'\\''")}'`;
  exec(cmd, (err) => {
    if (err) console.warn(`[oauth] failed to open browser: ${err.message}`);
  });
}

export async function loginProvider(providerId: string): Promise<void> {
  if (providerId !== "anthropic") {
    throw new Error(`OAuth login for ${providerId} not yet wired`);
  }
  const credentials = await loginAnthropic({
    onAuth: (info: { url: string; instructions?: string }) => {
      console.log(`[oauth] opening browser for ${providerId} consent`);
      console.log(`[oauth] URL: ${info.url}`);
      openBrowser(info.url);
    },
    onPrompt: async (p: OAuthPrompt) => {
      throw new Error(`unexpected interactive oauth prompt: ${p.message}`);
    },
    onProgress: (m: string) => console.log(`[oauth] ${m}`),
  });
  const store = await readStore();
  store.providers[providerId] = credentials;
  await writeStore(store);
  console.log(`[oauth] credentials saved for ${providerId}`);
}

export async function getOAuthApiKey(providerId: string): Promise<string | null> {
  const store = await readStore();
  const creds = store.providers[providerId];
  if (!creds) return null;
  const provider = getOAuthProvider(providerId);
  if (!provider) throw new Error(`no OAuth provider impl for ${providerId}`);

  if (typeof creds.expires === "number" && creds.expires < Date.now() + REFRESH_LEAD_MS) {
    console.log(`[oauth] refreshing token for ${providerId}`);
    const fresh = await provider.refreshToken(creds);
    store.providers[providerId] = fresh;
    await writeStore(store);
    return provider.getApiKey(fresh);
  }
  return provider.getApiKey(creds);
}

export async function authStatus(): Promise<Record<string, boolean>> {
  const store = await readStore();
  const out: Record<string, boolean> = {};
  for (const id of Object.keys(store.providers)) out[id] = true;
  return out;
}

export async function clearProvider(providerId: string): Promise<void> {
  const store = await readStore();
  delete store.providers[providerId];
  await writeStore(store);
}
