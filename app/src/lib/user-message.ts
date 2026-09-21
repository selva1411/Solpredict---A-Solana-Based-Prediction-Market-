export const USER_MESSAGE_PREFIX = "SOLPredict user request:";

// How long a signed ownership proof stays valid. The proof is cached
// client-side (localStorage) and replayed on every request instead of
// re-prompting the wallet each time, so it must carry its own bounded
// lifetime — otherwise a leaked proof (XSS, devtools, a logged request)
// would be a permanent, unrevokable credential for that wallet.
export const USER_MESSAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function buildUserMessage(issuedAtMs: number = Date.now()): string {
  const expiresAtMs = issuedAtMs + USER_MESSAGE_TTL_MS;
  return [
    USER_MESSAGE_PREFIX,
    `Issued At: ${new Date(issuedAtMs).toISOString()}`,
    `Expires At: ${new Date(expiresAtMs).toISOString()}`,
  ].join("\n");
}

/**
 * Extract and validate the `Expires At:` line from a message built by
 * `buildUserMessage`. Returns false if the line is missing, malformed, or in
 * the past.
 */
export function isUserMessageExpired(message: string): boolean {
  const match = /Expires At:\s*(\S+)/.exec(message);
  if (!match) return true;
  const expiresAtMs = Date.parse(match[1]);
  if (Number.isNaN(expiresAtMs)) return true;
  return Date.now() > expiresAtMs;
}
