import { wedding } from "./wedding-config.js?v=20261013-1";

const form = document.querySelector("#guest-form");
const rows = document.querySelector("#guest-rows");
const emptyState = document.querySelector("#empty-state");
const search = document.querySelector("#guest-search");
const exportGuests = document.querySelector("#export-guests");
const baseInput = document.querySelector("#public-base");
const guestNameInput = document.querySelector("#guest-name");
const guestPhoneInput = document.querySelector("#guest-phone");
const companionsInput = document.querySelector("#guest-companions");
const formHeading = document.querySelector("#form-heading");
const formDescription = document.querySelector("#form-description");
const submitLabel = document.querySelector("#submit-label");
const cancelEdit = document.querySelector("#cancel-edit");
const createdBox = document.querySelector("#created-link");
const createdLabel = document.querySelector("#created-link-label");
const createdValue = document.querySelector("#created-link-value");
const copyCreated = document.querySelector("#copy-created-link");
const toast = document.querySelector("#toast");
const number = new Intl.NumberFormat("fa-IR");
const dateTime = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });
let invitations = [];
let editingInvitationId = null;
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

async function copyText(text, successMessage = "لینک دعوت کپی شد.") {
  await navigator.clipboard.writeText(text);
  showToast(successMessage);
}

function invitationMessage(invitation) {
  const companions = invitation.includeCompanions ? `\n${wedding.companions}` : "";
  return `سلام و عرض ادب 🌿\n\n${invitation.guestName}${companions}\n\nبا افتخار از شما دعوت می‌کنیم در جشن پیوند ${wedding.bride} و ${wedding.groom} در کنارمان باشید.\n\nبرای مشاهدهٔ دعوت‌نامهٔ اختصاصی:\n${inviteUrl(invitation.token)}`;
}

function formatDate(value) {
  return value ? dateTime.format(new Date(value)) : "—";
}

function rsvpLabel(status) {
  if (status === "yes") return "شرکت می‌کنند";
  if (status === "no") return "شرکت نمی‌کنند";
  return "بدون پاسخ";
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function excelCell(value, { type = "String", style = "Cell", href = "" } = {}) {
  const link = href ? ` ss:HRef="${escapeXml(href)}"` : "";
  return `<Cell ss:StyleID="${style}"${link}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function exportInvitations() {
  if (!invitations.length) {
    showToast("هنوز مهمانی برای خروجی گرفتن وجود ندارد.", true);
    return;
  }

  const headers = ["ردیف", "نام مهمان", "همراه خانواده", "شماره تلفن", "بازشدن لینک", "بازشدن کارت", "پاسخ حضور", "تاریخ ساخت", "آخرین فعالیت", "لینک دعوت"];
  const headerRow = `<Row>${headers.map((header) => excelCell(header, { style: "Header" })).join("")}</Row>`;
  const dataRows = invitations.map((invitation, index) => {
    const link = inviteUrl(invitation.token);
    const lastActivity = invitation.rsvpUpdatedAt || invitation.lastCardOpenedAt || invitation.lastViewedAt || invitation.createdAt;
    return `<Row>${[
      excelCell(index + 1, { type: "Number" }),
      excelCell(invitation.guestName),
      excelCell(invitation.includeCompanions ? "بله" : "خیر"),
      excelCell(invitation.phone || ""),
      excelCell(invitation.viewCount || 0, { type: "Number" }),
      excelCell(invitation.cardOpenCount || 0, { type: "Number" }),
      excelCell(rsvpLabel(invitation.rsvpStatus)),
      excelCell(formatDate(invitation.createdAt)),
      excelCell(formatDate(lastActivity)),
      excelCell(link, { style: "Link", href: link }),
    ].join("")}</Row>`;
  }).join("");

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>فهرست مهمان‌های عروسی ${escapeXml(wedding.bride)} و ${escapeXml(wedding.groom)}</Title></DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Tahoma" ss:Size="11"/></Style>
    <Style ss:ID="Cell"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E9DDE0"/></Borders></Style>
    <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/><Font ss:FontName="Tahoma" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#9F7427" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Link"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:FontName="Tahoma" ss:Size="10" ss:Color="#356580" ss:Underline="Single"/></Style>
  </Styles>
  <Worksheet ss:Name="مهمان‌ها"><Table ss:DefaultRowHeight="24">
    <Column ss:Width="45"/><Column ss:Width="180"/><Column ss:Width="90"/><Column ss:Width="100"/><Column ss:Width="85"/><Column ss:Width="85"/><Column ss:Width="100"/><Column ss:Width="145"/><Column ss:Width="145"/><Column ss:Width="260"/>
    ${headerRow}${dataRows}
  </Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><DisplayRightToLeft/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>
</Workbook>`;

  const blob = new Blob(["\ufeff", workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const download = document.createElement("a");
  const date = (wedding.dateDisplay || new Date().toISOString().slice(0, 10)).replaceAll("/", "-");
  download.href = objectUrl;
  download.download = `wedding-guests-${date}.xls`;
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  showToast("فایل اکسل مهمان‌ها دانلود شد.");
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
    const companions = document.createElement("td");
    const companionsStatus = document.createElement("span");
    companionsStatus.className = `status ${invitation.includeCompanions ? "status--family" : "status--pending"}`;
    companionsStatus.textContent = invitation.includeCompanions ? "نمایش داده می‌شود" : "نمایش داده نمی‌شود";
    companions.append(companionsStatus);
    tr.append(companions);
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
    const copyMessage = document.createElement("button");
    copyMessage.type = "button";
    copyMessage.className = "message-button";
    copyMessage.setAttribute("aria-label", `کپی پیام دعوت ${invitation.guestName}`);
    copyMessage.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg><span>کپی پیام</span>';
    copyMessage.addEventListener("click", () => copyText(invitationMessage(invitation), "پیام دعوت آمادهٔ ارسال کپی شد.").catch(() => showToast("کپی پیام انجام نشد.", true)));
    const linkActions = document.createElement("div");
    linkActions.className = "link-actions";
    linkActions.append(copy, copyMessage);
    linkCell.append(linkActions);
    tr.append(linkCell);

    const actionCell = document.createElement("td");
    actionCell.className = "row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "edit-button";
    edit.setAttribute("aria-label", `ویرایش ${invitation.guestName}`);
    edit.textContent = "ویرایش";
    edit.addEventListener("click", () => startEditing(invitation));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.setAttribute("aria-label", `حذف ${invitation.guestName}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => removeInvitation(invitation));
    actionCell.append(edit, remove);
    tr.append(actionCell);
    rows.append(tr);
  }
}

function renderSummary() {
  document.querySelector("#total-count").textContent = number.format(invitations.length);
  document.querySelector("#viewed-count").textContent = number.format(invitations.filter((item) => item.viewCount > 0).length);
  document.querySelector("#yes-count").textContent = number.format(invitations.filter((item) => item.rsvpStatus === "yes").length);
  document.querySelector("#no-count").textContent = number.format(invitations.filter((item) => item.rsvpStatus === "no").length);
  exportGuests.disabled = invitations.length === 0;
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
  if (editingInvitationId === invitation.id) resetFormMode();
  showToast("مهمان حذف شد.");
  await loadInvitations({ quiet: true });
}

function startEditing(invitation) {
  editingInvitationId = invitation.id;
  guestNameInput.value = invitation.guestName;
  guestPhoneInput.value = invitation.phone || "";
  companionsInput.checked = invitation.includeCompanions !== false;
  formHeading.textContent = "ویرایش دعوت‌نامه";
  formDescription.textContent = "عنوان و تنظیم نمایش خانواده را تغییر دهید؛ لینک مهمان ثابت می‌ماند.";
  submitLabel.textContent = "ذخیره تغییرات";
  cancelEdit.hidden = false;
  createdBox.hidden = true;
  form.closest(".create-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  guestNameInput.focus({ preventScroll: true });
}

function resetFormMode({ keepBase = true } = {}) {
  const base = normalizeBase(baseInput.value) || location.origin;
  editingInvitationId = null;
  form.reset();
  if (keepBase) baseInput.value = base;
  companionsInput.checked = true;
  formHeading.textContent = "ساخت لینک دعوت جدید";
  formDescription.textContent = "برای هر مهمان یک لینک امن و اختصاصی بسازید.";
  submitLabel.textContent = "ساخت لینک اختصاصی";
  cancelEdit.hidden = true;
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
    const isEditing = editingInvitationId !== null;
    const invitationId = editingInvitationId;
    const response = await fetch(isEditing ? `/api/admin/invitations/${invitationId}` : "/api/admin/invitations", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: payload.guestName,
        phone: payload.phone,
        includeCompanions: companionsInput.checked,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || (isEditing ? "UPDATE_FAILED" : "CREATE_FAILED"));
    const link = inviteUrl(result.invitation.token);
    createdValue.value = link;
    createdLabel.textContent = isEditing ? "دعوت‌نامه به‌روزرسانی شد؛ لینک مهمان تغییر نکرد" : "لینک مهمان آماده شد";
    createdBox.hidden = false;
    resetFormMode();
    showToast(isEditing ? "تغییرات دعوت‌نامه ذخیره شد." : "لینک اختصاصی ساخته شد.");
    await loadInvitations({ quiet: true });
  } catch (error) {
    const fallback = editingInvitationId !== null ? "ویرایش دعوت‌نامه انجام نشد." : "ساخت لینک انجام نشد.";
    showToast(["CREATE_FAILED", "UPDATE_FAILED"].includes(error.message) ? fallback : error.message, true);
  } finally {
    button.disabled = false;
  }
});

copyCreated.addEventListener("click", () => copyText(createdValue.value).catch(() => showToast("کپی لینک انجام نشد.", true)));
exportGuests.addEventListener("click", exportInvitations);
cancelEdit.addEventListener("click", () => resetFormMode());
search.addEventListener("input", renderRows);
loadInvitations();
setInterval(() => loadInvitations({ quiet: true }), 15_000);
