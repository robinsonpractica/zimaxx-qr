export type CodeStatus = "active" | "disabled" | "archived";
export type DeviceCategory = "mobile" | "tablet" | "desktop" | "bot" | "unknown";
export type ErrorCorrection = "L" | "M" | "Q" | "H";

export class DomainError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  if (slug.length < 3 || slug.length > 64) throw new DomainError("invalid_slug", "Use 3–64 letters, numbers, or hyphens.");
  return slug;
}

export function normalizeHex(value: string): string {
  const color = value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) throw new DomainError("invalid_color", "Use a six-digit hex color.");
  return color;
}

export function normalizeDestination(value: string, redirectOrigin?: string): string {
  if (value.length > 2048) throw new DomainError("destination_too_long", "The destination is too long.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new DomainError("invalid_destination", "Enter a complete http or https URL."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new DomainError("unsafe_protocol", "Only http and https destinations are allowed.");
  if (url.username || url.password) throw new DomainError("embedded_credentials", "URLs containing credentials are not allowed.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new DomainError("private_destination", "Private-network destinations are not allowed.");
  }
  if (redirectOrigin) {
    const origin = new URL(redirectOrigin);
    if (url.host === origin.host && /^\/r\//.test(url.pathname)) throw new DomainError("redirect_loop", "A Zimaxx QR redirect cannot target another Zimaxx QR redirect.");
  }
  url.hash = "";
  return url.toString();
}

function rgb(hex: string) { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function luminance(hex: string) { return rgb(hex).map((v) => { const s = v / 255; return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0); }
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(normalizeHex(foreground)); const b = luminance(normalizeHex(background));
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
export function scannability(foreground: string, background: string, hasLogo: boolean) {
  const ratio = contrastRatio(foreground, background);
  return { ratio, passed: ratio >= 4.5, level: hasLogo ? "H" as ErrorCorrection : undefined, message: ratio >= 4.5 ? "Strong contrast for reliable scanning." : "Increase contrast before printing." };
}

export function effectiveErrorCorrection(requested: string, hasLogo: boolean): ErrorCorrection {
  const valid: ErrorCorrection[] = ["L", "M", "Q", "H"];
  const level = valid.includes(requested as ErrorCorrection) ? requested as ErrorCorrection : "M";
  return hasLogo ? "H" : level;
}

export function transitionStatus(current: CodeStatus, next: CodeStatus): CodeStatus {
  if (current === next) return current;
  if (current === "archived") throw new DomainError("terminal_status", "Archived codes cannot be restored from the product UI.");
  if (next === "archived" || (current === "active" && next === "disabled") || (current === "disabled" && next === "active")) return next;
  throw new DomainError("invalid_transition", `Cannot change ${current} to ${next}.`);
}

export function deviceCategory(userAgent: string | null): DeviceCategory {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "unknown";
  if (/bot|crawler|spider|slurp|preview/.test(ua)) return "bot";
  if (/ipad|tablet|kindle|silk/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

export function utcDate(date = new Date()): string { return date.toISOString().slice(0, 10); }
export function newId(prefix: string): string { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }
