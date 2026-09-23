const form = document.querySelector("#guest-form");
const rows = document.querySelector("#guest-rows");
const emptyState = document.querySelector("#empty-state");
const search = document.querySelector("#guest-search");
const baseInput = document.querySelector("#public-base");
const createdBox = document.querySelector("#created-link");
const createdValue = document.querySelector("#created-link-value");
const copyCreated = document.querySelector("#copy-created-link");
const toast = document.querySelector("#toast");
const number = new Intl.NumberFormat("fa-IR");
const dateTime = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });
let invitations = [];
let toastTimer;

baseInput.value = localStorage.getItem("wedding-public-base") || location.origin;
baseInput.addEventListener("change", () => {
  const value = normalizeBase(baseInput.value);
  if (value) {
    baseInput.value = value;
    localStorage.setItem("wedding-public-base", value);
    renderRows();
  }
});

function normalizeBase(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function inviteUrl(token) {
  const base = normalizeBase(baseInput.value) || location.origin;
  return `${base}/i/${encodeURIComponent(token)}`;
}

function showToast(message, error = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", error);
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  showToast("لینک دعوت کپی شد.");
}

function formatDate(value) {
  return value ? dateTime.format(new Date(value)) : "—";
}

function statusElement(invitation) {
  const span = document.createElement("span");
  if (invitation.rsvpStatus === "yes") {
    span.className = "status status--yes";
    span.textContent = "✓ شرکت می‌کنند";
  } else if (invitation.rsvpStatus === "no") {
    span.className = "status status--no";
    span.textContent = "× شرکت نمی‌کنند";
  } else {
    span.className = "status status--pending";
    span.textContent = "بدون پاسخ";
  }
  return span;
}

function cell(text, className = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function renderRows() {
  const phrase = search.value.trim().toLocaleLowerCase("fa");
  const filtered = invitations.filter((item) => !phrase || item.guestName.toLocaleLowerCase("fa").includes(phrase) || (item.phone || "").includes(phrase));
  rows.replaceChildren();
  emptyState.hidden = filtered.length !== 0;

  for (const invitation of filtered) {
    const tr = document.createElement("tr");
    tr.append(cell(invitation.guestName));
    tr.append(cell(invitation.phone || "—", invitation.phone ? "" : "muted"));

    const viewed = document.createElement("td");
    const viewedStatus = document.createElement("span");
    viewedStatus.className = `status ${invitation.viewCount ? "status--viewed" : "status--pending"}`;
    viewedStatus.textContent = invitation.viewCount ? `${number.format(invitation.viewCount)} بار` : "باز نشده";
    viewed.append(viewedStatus);
    tr.append(viewed);

    tr.append(cell(invitation.cardOpenCount ? `${number.format(invitation.cardOpenCount)} بار` : "—", invitation.cardOpenCount ? "" : "muted"));
    const answer = document.createElement("td");
    answer.append(statusElement(invitation));
    tr.append(answer);
    tr.append(cell(formatDate(invitation.rsvpUpdatedAt || invitation.lastCardOpenedAt || invitation.lastViewedAt || invitation.createdAt)));

    const linkCell = document.createElement("td");
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-button";
    copy.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>کپی لینک</span>';
    copy.addEventListener("click", () => copyText(inviteUrl(invitation.token)).catch(() => showToast("کپی لینک انجام نشد.", true)));
    linkCell.append(copy);
    tr.append(linkCell);

    const actionCell = document.createElement("td");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.setAttribute("aria-label", `حذف ${invitation.guestName}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => removeInvitation(invitation));
    actionCell.append(remove);
    tr.append(actionCell);
    rows.append(tr);
  }
}

function renderSummary() {
  document.querySelector("#total-count").textContent = number.format(invitations.length);
  document.querySelector("#viewed-count").textContent = number.format(invitations.filter((item) => item.viewCount > 0).length);
  document.querySelector("#yes-count").textContent = number.format(invitations.filter((item) => item.rsvpStatus === "yes").length);
  document.querySelector("#no-count").textContent = number.format(invitations.filter((item) => item.rsvpStatus === "no").length);
}

async function loadInvitations({ quiet = false } = {}) {
  try {
    const response = await fetch("/api/admin/invitations", { cache: "no-store" });
    if (!response.ok) throw new Error("LOAD_FAILED");
    invitations = (await response.json()).invitations;
    renderSummary();
    renderRows();
  } catch {
    if (!quiet) showToast("دریافت اطلاعات مهمان‌ها انجام نشد.", true);
  }
}

async function removeInvitation(invitation) {
  if (!confirm(`دعوت‌نامهٔ «${invitation.guestName}» حذف شود؟`)) return;
  const response = await fetch(`/api/admin/invitations/${invitation.id}`, { method: "DELETE" });
  if (!response.ok) {
    showToast("حذف مهمان انجام نشد.", true);
    return;
  }
  showToast("مهمان حذف شد.");
  await loadInvitations({ quiet: true });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  const payload = Object.fromEntries(new FormData(form));
  const base = normalizeBase(baseInput.value);
  if (!base) {
    showToast("آدرس عمومی سایت معتبر نیست.", true);
    baseInput.focus();
    return;
  }
  localStorage.setItem("wedding-public-base", base);
  button.disabled = true;
  try {
    const response = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName: payload.guestName, phone: payload.phone }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "CREATE_FAILED");
    const link = inviteUrl(result.invitation.token);
    createdValue.value = link;
    createdBox.hidden = false;
    form.reset();
    baseInput.value = base;
    showToast("لینک اختصاصی ساخته شد.");
    await loadInvitations({ quiet: true });
  } catch (error) {
    showToast(error.message === "CREATE_FAILED" ? "ساخت لینک انجام نشد." : error.message, true);
  } finally {
    button.disabled = false;
  }
});

copyCreated.addEventListener("click", () => copyText(createdValue.value).catch(() => showToast("کپی لینک انجام نشد.", true)));
search.addEventListener("input", renderRows);
loadInvitations();
setInterval(() => loadInvitations({ quiet: true }), 15_000);
