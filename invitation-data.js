export function getGuestName(search, fallback) {
  const name = new URLSearchParams(search).get("guest")?.trim();
  return name ? Array.from(name).slice(0, 120).join("") : fallback;
}

export function getWeddingTimestamp(value) {
  // An explicit offset keeps the countdown identical in every guest's time zone.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getCountdown(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return null;
  const seconds = Math.max(0, Math.ceil((timestamp - now) / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
    started: timestamp <= now,
  };
}

export function getNeshanUrl(value) {
  try {
    const url = new URL(value);
    const isNeshan = ["neshan.org", "nshn.ir"].some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
    return url.protocol === "https:" && isNeshan && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
