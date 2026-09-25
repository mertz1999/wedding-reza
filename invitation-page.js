import { wedding } from "./wedding-config.js";
import { getGuestName, getWeddingTimestamp, getCountdown, getNeshanUrl } from "./invitation-data.js";

const card = document.querySelector("#wedding-card");
const cardFrame = card.querySelector(".wedding-card__frame");
const storyThread = card.querySelector(".story-thread");
const storyMarkers = [...card.querySelectorAll(".story-thread__marker")];
const scrollPrompt = document.querySelector("#scroll-prompt");
const guestHeading = document.querySelector("#guest-heading");
const status = document.querySelector("#countdown-status");
const hasCeremonyTime = getWeddingTimestamp(wedding.startsAt) !== null;
const eventDate = hasCeremonyTime ? wedding.startsAt : wedding.date ? `${wedding.date}T00:00:00+03:30` : "";
const timestamp = getWeddingTimestamp(eventDate);
const digits = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });
const fields = Object.fromEntries(["days", "hours", "minutes", "seconds"].map((key) => [key, document.querySelector(`#countdown-${key}`)]));
const invitationToken = window.location.pathname.match(/^\/i\/([A-Za-z0-9_-]+)\/?$/)?.[1] || new URLSearchParams(window.location.search).get("invite")?.trim() || "";
let guestName = getGuestName(window.location.search, wedding.guest);
const rsvpButtons = [...document.querySelectorAll("[data-rsvp]")];
const rsvpFeedback = document.querySelector("#rsvp-feedback");
let rsvpStorageKey = `wedding-rsvp:v1:${wedding.date || "undated"}:${invitationToken || guestName}`;
let countdownInterval;
let revealObserver;
let openingRevealTimers = [];
let scrollFrame;
let smoothScrollTarget = 0;
let smoothScrollingReady = false;
let cardOpenRecorded = false;
let storyFrame;
let storyResizeObserver;
let storyListenersReady = false;
let storyStart = 0;
let storyEnd = 0;
let scrollPromptTimer;
let scrollPromptDismissTimer;
let scrollPromptDismissed = false;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function setText(id, text, fallback = "") {
  document.getElementById(id).textContent = text?.trim() || fallback;
}

setText("guest-name", guestName, "مهمان گرامی");
setText("guest-companions", wedding.companions);
setText("bride-name", wedding.bride, "نام عروس");
setText("groom-name", wedding.groom, "نام داماد");
setText("bride-family", wedding.brideFamily);
setText("groom-family", wedding.groomFamily);
setText("invitation-copy", wedding.invitation);
setText("venue-name", wedding.venue, "نام محل برگزاری");
setText("venue-address", wedding.address, "نشانی محل برگزاری مراسم اینجا قرار می‌گیرد.");

if (timestamp !== null) {
  const date = new Date(timestamp);
  const options = { timeZone: wedding.timeZone || "Asia/Tehran" };
  const dateElement = document.querySelector("#wedding-date");
  dateElement.dateTime = hasCeremonyTime ? wedding.startsAt : wedding.date;
  const dateParts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    ...options, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).formatToParts(date);
  const part = (type) => dateParts.find((item) => item.type === type)?.value || "";
  dateElement.textContent = `${part("weekday")}، ${part("day")} ${part("month")} ${part("year")}`;
  setText("wedding-time", hasCeremonyTime ? `ساعت ${new Intl.DateTimeFormat("fa-IR", { ...options, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}` : "ساعت مراسم به‌زودی اعلام می‌شود");
  setText("countdown-heading", hasCeremonyTime ? "تا آغازِ جشن عروسی‌مان" : "تا روزِ عروسی‌مان");
}

const locationUrl = getNeshanUrl(wedding.neshanUrl);
if (locationUrl) {
  const link = document.querySelector("#neshan-link");
  link.href = locationUrl;
  link.removeAttribute("aria-disabled");
  link.removeAttribute("tabindex");
  setText("location-note", "برای دیدن مسیر، موقعیت مراسم را در نشان باز کنید.");
}

function rsvpMessage(response, persisted = true) {
  if (!persisted) return "انتخاب شما انجام شد، اما مرورگر اجازهٔ ذخیره‌سازی پاسخ را نداد.";
  return response === "yes"
    ? "چه خوشحالیم که در این شب کنارمان هستید. پاسخ شما روی این دستگاه ثبت شد."
    : "جای شما در این شب خالی خواهد بود. پاسخ شما روی این دستگاه ثبت شد.";
}

function setRsvp(response, { save = true } = {}) {
  if (!['yes', 'no'].includes(response)) return;
  for (const button of rsvpButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.rsvp === response));
  }
  let persisted = true;
  if (save) {
    try { localStorage.setItem(rsvpStorageKey, response); } catch { persisted = false; }
  }
  rsvpFeedback.textContent = rsvpMessage(response, persisted);
}

for (const button of rsvpButtons) {
  button.addEventListener("click", () => {
    const response = button.dataset.rsvp;
    setRsvp(response);
    if (invitationToken) void saveRsvpToDatabase(response);
  });
}

try {
  const savedRsvp = localStorage.getItem(rsvpStorageKey);
  if (savedRsvp) setRsvp(savedRsvp, { save: false });
} catch { /* The RSVP remains usable even when storage is unavailable. */ }

async function hydrateInvitation() {
  if (!invitationToken) return;
  try {
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationToken)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("INVITATION_NOT_FOUND");
    const { invitation } = await response.json();
    guestName = invitation.guestName;
    rsvpStorageKey = `wedding-rsvp:v1:${wedding.date || "undated"}:${invitationToken}`;
    setText("guest-name", guestName, "مهمان گرامی");
    document.title = `دعوت‌نامهٔ ${guestName}`;
    if (invitation.rsvpStatus) setRsvp(invitation.rsvpStatus, { save: false });
  } catch {
    rsvpFeedback.textContent = "لینک اختصاصی این دعوت‌نامه معتبر نیست؛ نسخهٔ عمومی نمایش داده می‌شود.";
  }
}

async function saveRsvpToDatabase(response) {
  rsvpFeedback.textContent = "در حال ثبت پاسخ شما…";
  try {
    const result = await fetch(`/api/invitations/${encodeURIComponent(invitationToken)}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    if (!result.ok) throw new Error("RSVP_FAILED");
    rsvpFeedback.textContent = response === "yes"
      ? "چه خوشحالیم که در این شب کنارمان هستید. پاسخ شما ثبت شد."
      : "جای شما در این شب خالی خواهد بود. پاسخ شما ثبت شد.";
  } catch {
    rsvpFeedback.textContent = "پاسخ روی این دستگاه ذخیره شد، اما ثبت آن در فهرست مهمان‌ها انجام نشد؛ لطفاً دوباره تلاش کنید.";
  }
}

async function recordCardOpen() {
  if (!invitationToken || cardOpenRecorded) return;
  cardOpenRecorded = true;
  try {
    await fetch(`/api/invitations/${encodeURIComponent(invitationToken)}/open`, { method: "POST" });
  } catch { /* Opening the invitation must continue even if tracking is unavailable. */ }
}

export const invitationDataReady = hydrateInvitation();

function updateCountdown() {
  const remaining = getCountdown(timestamp);
  if (!remaining) return;
  for (const [key, element] of Object.entries(fields)) element.textContent = digits.format(remaining[key]);
  const text = remaining.started ? "روز پیوند ما فرا رسیده است" : hasCeremonyTime ? "" : "شمارش تا آغاز روز عروسی";
  if (status.textContent !== text) status.textContent = text;
  if (remaining.started) clearInterval(countdownInterval);
}

function startCountdown() {
  clearInterval(countdownInterval);
  updateCountdown();
  if (timestamp !== null && timestamp > Date.now()) countdownInterval = setInterval(updateCountdown, 1000);
}

function startScrollReveals() {
  const sections = [...card.querySelectorAll(".guest, .hero-cutout, .countdown, .couple, .celebration, .rsvp, .card-footer, .venue-finale")];
  const guest = card.querySelector(".guest");
  const hero = card.querySelector(".hero-cutout");
  const openingSections = new Set([guest, hero]);
  for (const section of sections) {
    section.classList.add("reveal-on-scroll");
    if (section.classList.contains("couple")) continue;

    const textItems = [...section.querySelectorAll("h1, h2, p, time, .countdown__digits, .location-link, .rsvp__choice, .card-flourish, .celebration__date > svg, .celebration__venue > svg, .rsvp__mark, :scope > span")]
      .filter((item) => !item.classList.contains("orchid-decor"));
    for (const [index, item] of textItems.entries()) {
      item.classList.add("reveal-item");
      item.style.setProperty("--reveal-order", String(index));
    }
  }

  if (!("IntersectionObserver" in window)) {
    for (const section of sections) section.classList.add("is-revealed");
    return;
  }

  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    }
  }, { threshold: .1, rootMargin: "0px 0px -7% 0px" });

  for (const section of sections) {
    if (!openingSections.has(section)) revealObserver.observe(section);
  }

  for (const timer of openingRevealTimers) window.clearTimeout(timer);
  openingRevealTimers = [
    window.setTimeout(() => guest?.classList.add("is-revealed"), 650),
    window.setTimeout(() => hero?.classList.add("is-revealed"), 1300),
  ];
}

function updateStoryThread() {
  storyFrame = undefined;
  if (card.hidden || !storyThread || storyEnd <= storyStart) return;
  const frameTop = cardFrame.getBoundingClientRect().top;
  const readingLine = window.innerHeight * .58;
  const absoluteProgress = Math.min(storyEnd, Math.max(storyStart, readingLine - frameTop));
  storyThread.style.setProperty("--story-progress", `${absoluteProgress - storyStart}px`);
  for (const marker of storyMarkers) {
    marker.classList.toggle("is-passed", absoluteProgress >= Number(marker.dataset.storyTop || 0));
  }
}

function queueStoryUpdate() {
  if (!storyFrame) storyFrame = window.requestAnimationFrame(updateStoryThread);
}

function layoutStoryThread() {
  if (card.hidden || !storyThread) return;
  const frameBounds = cardFrame.getBoundingClientRect();
  const positions = [];
  for (const marker of storyMarkers) {
    const target = card.querySelector(marker.dataset.storyTarget);
    if (!target) continue;
    const targetBounds = target.getBoundingClientRect();
    const top = targetBounds.top - frameBounds.top + Math.min(64, targetBounds.height * .24);
    marker.dataset.storyTop = String(top);
    marker.style.setProperty("--marker-top", `${top}px`);
    positions.push(top);
  }
  if (positions.length < 2) return;
  storyStart = Math.min(...positions);
  storyEnd = Math.max(...positions);
  storyThread.style.setProperty("--story-start", `${storyStart}px`);
  storyThread.style.setProperty("--story-length", `${storyEnd - storyStart}px`);
  queueStoryUpdate();
}

function startStoryThread() {
  if (!storyThread) return;
  if (!storyListenersReady) {
    storyListenersReady = true;
    window.addEventListener("scroll", queueStoryUpdate, { passive: true });
    window.addEventListener("resize", layoutStoryThread);
  }
  if ("ResizeObserver" in window) {
    storyResizeObserver?.disconnect();
    storyResizeObserver = new ResizeObserver(layoutStoryThread);
    storyResizeObserver.observe(cardFrame);
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(layoutStoryThread));
  document.fonts?.ready.then(layoutStoryThread);
}

function maximumScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function clampScroll(value) {
  return Math.min(maximumScroll(), Math.max(0, value));
}

function moveSmoothlyTo(target) {
  smoothScrollTarget = clampScroll(target);
  if (scrollFrame) return;

  const step = () => {
    const distance = smoothScrollTarget - window.scrollY;
    if (Math.abs(distance) < .75) {
      window.scrollTo({ top: smoothScrollTarget, behavior: "instant" });
      scrollFrame = undefined;
      return;
    }

    window.scrollTo({ top: window.scrollY + distance * .14, behavior: "instant" });
    scrollFrame = window.requestAnimationFrame(step);
  };

  scrollFrame = window.requestAnimationFrame(step);
}

function stopSmoothScroll() {
  if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
  scrollFrame = undefined;
  smoothScrollTarget = window.scrollY;
}

function dismissScrollPrompt() {
  scrollPromptDismissed = true;
  window.clearTimeout(scrollPromptTimer);
  window.clearTimeout(scrollPromptDismissTimer);
  if (!scrollPrompt || scrollPrompt.hidden) return;
  scrollPrompt.classList.remove("is-visible");
  scrollPrompt.classList.add("is-dismissed");
  scrollPrompt.disabled = true;
  scrollPromptDismissTimer = window.setTimeout(() => {
    scrollPrompt.hidden = true;
  }, prefersReducedMotion.matches ? 20 : 420);
}

function startScrollPrompt() {
  if (!scrollPrompt) return;
  window.clearTimeout(scrollPromptTimer);
  window.clearTimeout(scrollPromptDismissTimer);
  scrollPromptDismissed = false;
  scrollPrompt.hidden = true;
  scrollPrompt.disabled = false;
  scrollPrompt.classList.remove("is-visible", "is-dismissed");
  scrollPromptTimer = window.setTimeout(() => {
    if (card.hidden || scrollPromptDismissed || window.scrollY > 18) return;
    scrollPrompt.hidden = false;
    window.requestAnimationFrame(() => scrollPrompt.classList.add("is-visible"));
  }, prefersReducedMotion.matches ? 950 : 1500);
}

function handleScrollPromptScroll() {
  if (!card.hidden && !scrollPromptDismissed && !scrollPrompt?.hidden && window.scrollY > 18) dismissScrollPrompt();
}

scrollPrompt?.addEventListener("click", () => {
  const target = card.querySelector(".countdown");
  const targetTop = target
    ? target.getBoundingClientRect().top + window.scrollY - 24
    : window.scrollY + window.innerHeight * .78;
  dismissScrollPrompt();
  if (prefersReducedMotion.matches) window.scrollTo({ top: clampScroll(targetTop), behavior: "instant" });
  else moveSmoothlyTo(targetTop);
});

window.addEventListener("scroll", handleScrollPromptScroll, { passive: true });

function startSmoothScrolling() {
  if (smoothScrollingReady) return;
  smoothScrollingReady = true;

  window.addEventListener("wheel", (event) => {
    if (card.hidden || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    const origin = scrollFrame ? smoothScrollTarget : window.scrollY;
    moveSmoothlyTo(origin + event.deltaY * unit * 1.08);
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (card.hidden || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;

    const page = window.innerHeight * .82;
    const distances = {
      ArrowDown: 90,
      ArrowUp: -90,
      PageDown: page,
      PageUp: -page,
      " ": event.shiftKey ? -page : page,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(event.key in distances)) return;

    event.preventDefault();
    const distance = distances[event.key];
    if (distance === Infinity) moveSmoothlyTo(maximumScroll());
    else if (distance === -Infinity) moveSmoothlyTo(0);
    else moveSmoothlyTo((scrollFrame ? smoothScrollTarget : window.scrollY) + distance);
  });

  window.addEventListener("touchstart", stopSmoothScroll, { passive: true });
  window.addEventListener("resize", () => { smoothScrollTarget = clampScroll(smoothScrollTarget); });
}

export function showWeddingCard({ keepPaper = false } = {}) {
  if (!card.hidden) return;
  void recordCardOpen();
  // Install hidden reveal styles before focus or layout can paint the card.
  startScrollReveals();
  document.documentElement.classList.add("card-is-visible");
  card.hidden = false;
  document.querySelector(".paper").hidden = !keepPaper;
  document.title = wedding.bride && wedding.groom ? `جشن عروسی ${wedding.bride} و ${wedding.groom}` : "کارت دعوت عروسی ما";
  window.scrollTo(0, 0);
  guestHeading.focus({ preventScroll: true });
  startCountdown();
  startSmoothScrolling();
  startStoryThread();
  startScrollPrompt();
}

window.addEventListener("pagehide", () => {
  clearInterval(countdownInterval);
  window.clearTimeout(scrollPromptTimer);
  window.clearTimeout(scrollPromptDismissTimer);
  for (const timer of openingRevealTimers) window.clearTimeout(timer);
  revealObserver?.disconnect();
  storyResizeObserver?.disconnect();
  if (storyFrame) window.cancelAnimationFrame(storyFrame);
  storyFrame = undefined;
  stopSmoothScroll();
});
window.addEventListener("pageshow", (event) => {
  if (card.hidden) return;
  startCountdown();
  startStoryThread();
  if (!scrollPromptDismissed && window.scrollY <= 18) startScrollPrompt();
  if (event.persisted) {
    // Timers/observers were stopped on pagehide; never restore invisible content.
    for (const section of card.querySelectorAll(".reveal-on-scroll")) section.classList.add("is-revealed");
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInterval(countdownInterval);
  else if (!card.hidden) startCountdown();
});
