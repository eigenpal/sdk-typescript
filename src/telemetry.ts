/**
 * SDK telemetry headers attached to every outbound request.
 *
 * The server reads these to track adoption — which language, which
 * version, which runtime are calling? Lets us answer "should we still
 * support Node 20?" or "is the 0.4 series still in use?" from log
 * aggregation alone, without having to ship a separate phone-home.
 *
 * Header convention follows the Stainless / Anthropic SDK pattern:
 *   X-Eigenpal-Sdk          — language tag ("typescript")
 *   X-Eigenpal-Sdk-Version  — package version (rewritten at publish)
 *   X-Eigenpal-Sdk-Runtime  — "bun-1.3.11" / "node-22.0.0" / "deno-X" / "browser"
 *   X-Eigenpal-Sdk-Os       — "darwin-arm64" / "linux-x64" / "browser"
 *
 * `User-Agent` carries the same info in a single human-readable string
 * for log lines and proxies that don't surface custom headers.
 */

export const SDK_LANGUAGE = 'typescript';
// Rewritten at publish time by scripts/render-sdk-versions.sh.
// Keep this string literal exactly stable — sed matches on it.
export const SDK_VERSION = '0.5.1';

function detectRuntime(): string {
  const g = globalThis as unknown as {
    Bun?: { version: string };
    Deno?: { version?: { deno?: string } };
  };
  if (g.Bun?.version) return `bun-${g.Bun.version}`;
  if (g.Deno?.version?.deno) return `deno-${g.Deno.version.deno}`;
  if (typeof process !== 'undefined' && process.versions?.node) {
    return `node-${process.versions.node}`;
  }
  return 'browser';
}

function detectOs(): string {
  if (typeof process !== 'undefined' && process.platform) {
    return `${process.platform}-${process.arch}`;
  }
  return 'browser';
}

export function buildTelemetryHeaders(): Record<string, string> {
  const runtime = detectRuntime();
  const os = detectOs();
  return {
    'X-Eigenpal-Sdk': SDK_LANGUAGE,
    'X-Eigenpal-Sdk-Version': SDK_VERSION,
    'X-Eigenpal-Sdk-Runtime': runtime,
    'X-Eigenpal-Sdk-Os': os,
    'User-Agent': `eigenpal-sdk-typescript/${SDK_VERSION} (${runtime}; ${os})`,
  };
}
