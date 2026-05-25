const SHEET_ID = "1OXPJTOaH0YVXy8E-P909bVFCu8R6-1k2-XuTsFpFOJI";
const API_KEY = "AIzaSyAkLjqv-i5uCyXbUFoCiwMDBz12UgGeSYc";
const SHEETS = { appels: "APPELS", rdv: "RDV" };

let currentTab = "dashboard";
let currentCalMonth = new Date();
let allAppels = [];
let allRdvs = [];

function formatDuree(s) {
  const t = parseInt(s) || 0, m = Math.floor(t / 60), r = t % 60;
  return m > 0 ? `${m}m${String(r).padStart(2, "0")}` : `${r}s`;
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const dm = Math.floor((now - d) / 60000), dh = Math.floor(dm / 60), dj = Math.floor(dh / 24);
  if (dm < 1) return "à l'instant";
  if (dm < 60) return `il y a ${dm} min`;
  if (dh < 24) return `aujourd'hui ${d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}`;
  if (dj === 1) return "hier";
  return d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}
function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
}
function formatDateFull(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" });
}
function typeInfo(t) {
  if (t === "rdv") return { icon: "📅", cls: "icon-rdv", badge: "badge-rdv" };
  if (t === "message") return { icon: "💬", cls: "icon-msg", badge: "badge-message" };
  return { icon: "📞", cls: "icon-info", badge: "badge-info" };
}

async function fetchSheet(name) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${name}!A:H?key=${API_KEY}`);
  const d = await r.json();
  return d.values || [];
}

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.tab === tab));
  document.querySelectorAll(".tab-content").forEach(el => el.classList.toggle("active", el.id === `tab-${tab}`));
  if (tab === "calendrier") renderCalendar();
  if (tab === "rdv") renderRdvFull("tous");
  if (tab === "messages") renderMessagesFull();
  if (tab === "appels") renderAppelsFull();
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(r) {
  const dt = new Date(r[3]);
  document.getElementById("modal-content").innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:4px">Rendez-vous</div>
      <div style="font-size:22px;font-weight:600;color:var(--text)">${r[5] || "Client"}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;font-size:13.5px;color:var(--text2)">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">📅</span>
        <span>${dt.toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">🕐</span>
        <span style="font-weight:600;color:var(--text)">${formatTime(r[3])}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">✂️</span>
        <span>${r[2] || "—"}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">💇</span>
        <span>${r[1] || "—"}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">📞</span>
        <span style="font-family:'DM Mono',monospace">${r[4] || "—"}</span>
      </div>
    </div>`;
  document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function renderDashboard() {
  const now = new Date(), dm = new Date(now.getFullYear(), now.getMonth(), 1);
  const mois = allAppels.filter(r => new Date(r[0]) >= dm);
  const rdvM = mois.filter(r => r[2] === "rdv"), msgM = mois.filter(r => r[2] === "message");
  const durs = mois.map(r => parseInt(r[1]) || 0).filter(d => d > 0);
  const moy = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
  const taux = mois.length ? Math.round(rdvM.length / mois.length * 100) : 0;

  document.getElementById("stat-appels").textContent = mois.length;
  document.getElementById("stat-rdv").textContent = rdvM.length;
  document.getElementById("stat-duree").textContent = moy ? formatDuree(moy) : "—";
  document.getElementById("stat-messages").textContent = msgM.length;
  document.getElementById("stat-taux").textContent = taux + "%";

  const derniers = allAppels.slice(-8).reverse();
  document.getElementById("liste-appels").innerHTML = derniers.length
    ? derniers.map(r => {
        const { icon, cls } = typeInfo(r[2]);
        return `<div class="call-item">
          <div class="call-icon ${cls}">${icon}</div>
          <div style="flex:1;min-width:0">
            <p class="call-name">${r[3] || "Inconnu"}</p>
            <p class="call-detail">${(r[5] || "Appel").substring(0, 70)}</p>
          </div>
          <span class="call-time">${formatDate(r[0])}</span>
        </div>`;
      }).join("")
    : '<p class="empty">Aucun appel</p>';

  const prochains = allRdvs
    .filter(r => r[3] && new Date(r[3]) >= now)
    .sort((a, b) => new Date(a[3]) - new Date(b[3]))
    .slice(0, 5);
  document.getElementById("liste-rdv").innerHTML = prochains.length
    ? prochains.map(r => {
        const dt = new Date(r[3]);
        return `<div class="rdv-item">
          <div class="rdv-date">
            <div class="rdv-day">${dt.getDate()}</div>
            <div class="rdv-month">${dt.toLocaleDateString("fr-CH", { month: "short" })}</div>
          </div>
          <div style="flex:1">
            <p class="rdv-name">${r[5] || "Client"}</p>
            <p class="rdv-service">${r[2] || ""} — ${r[1] || ""}</p>
          </div>
          <span class="rdv-heure">${formatTime(r[3])}</span>
        </div>`;
      }).join("")
    : '<p class="empty">Aucun RDV à venir</p>';

  const msgs = allAppels.filter(r => r[2] === "message").slice(-5).reverse();
  document.getElementById("liste-messages").innerHTML = msgs.length
    ? msgs.map(r => `<div class="msg-item">
        <div class="msg-header">
          <span class="msg-name">${r[3] || "Inconnu"}</span>
          <span class="msg-time">${formatDate(r[0])}</span>
        </div>
        <p class="msg-text">${r[5] || ""}</p>
      </div>`).join("")
    : '<p class="empty">Aucun message</p>';
}

// ── RDV Tab ────────────────────────────────────────────────────────────────
function renderRdvFull(filter) {
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
  const now = new Date();
  let rdvs = allRdvs.filter(r => r[3]);
  if (filter === "avenir") rdvs = rdvs.filter(r => new Date(r[3]) >= now);
  else if (filter === "passes") rdvs = rdvs.filter(r => new Date(r[3]) < now);
  rdvs.sort((a, b) => new Date(b[3]) - new Date(a[3]));
  document.getElementById("rdv-list-full").innerHTML = rdvs.length
    ? rdvs.map(r => {
        const dt = new Date(r[3]), past = dt < now;
        return `<div class="rdv-row ${past ? "past" : ""}" onclick='openModal(${JSON.stringify(r)})' style="cursor:pointer">
          <div>
            <div class="rdv-row-day">${dt.getDate()} ${dt.toLocaleDateString("fr-CH", { month: "short" })}</div>
            <div class="rdv-row-time">${formatTime(r[3])}</div>
          </div>
          <div>
            <div class="rdv-row-name">${r[5] || "Client"}</div>
            <div class="rdv-row-phone">${r[4] || ""}</div>
          </div>
          <div class="rdv-row-service">${r[2] || "—"}</div>
          <div class="rdv-row-coiff">${r[1] || "—"}</div>
          <div class="${past ? "status-past" : "status-avenir"}">${past ? "Passé" : "À venir"}</div>
        </div>`;
      }).join("")
    : '<p class="empty">Aucun rendez-vous</p>';
}

// ── Messages Tab ───────────────────────────────────────────────────────────
function renderMessagesFull() {
  const msgs = allAppels.filter(r => r[2] === "message").reverse();
  document.getElementById("messages-list-full").innerHTML = msgs.length
    ? msgs.map(r => `<div class="msg-full-item">
        <div class="msg-full-header">
          <div>
            <span class="msg-full-name">${r[3] || "Inconnu"}</span>
            <span class="msg-full-phone">${r[4] || ""}</span>
          </div>
          <span class="msg-full-time">${formatDateFull(r[0])} à ${formatTime(r[0])}</span>
        </div>
        <p class="msg-full-text">${r[5] || ""}</p>
      </div>`).join("")
    : '<p class="empty">Aucun message</p>';
}

// ── Appels Tab ─────────────────────────────────────────────────────────────
function renderAppelsFull() {
  const appels = [...allAppels].reverse();
  document.getElementById("appels-list-full").innerHTML = appels.length
    ? appels.map(r => {
        const { icon, cls, badge } = typeInfo(r[2]);
        return `<div class="appel-row">
          <div class="appel-row-icon ${cls}">${icon}</div>
          <div>
            <div class="appel-row-name">${r[3] || "Inconnu"}</div>
            <div class="appel-row-phone">${r[4] || ""}</div>
          </div>
          <div class="appel-row-date">${formatDateFull(r[0])} ${formatTime(r[0])}</div>
          <div class="appel-row-duree">${r[1] ? formatDuree(r[1]) : "—"}</div>
          <div class="appel-row-type ${badge}">${r[2] || "info"}</div>
          <div class="appel-row-transcript">${(r[5] || "").substring(0, 100)}</div>
        </div>`;
      }).join("")
    : '<p class="empty">Aucun appel</p>';
}

// ── Calendrier Tab ─────────────────────────────────────────────────────────
function renderCalendar() {
  const y = currentCalMonth.getFullYear(), m = currentCalMonth.getMonth(), now = new Date();
  document.getElementById("cal-title").textContent = currentCalMonth.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  let start = first.getDay() === 0 ? 6 : first.getDay() - 1;

  const byDay = {};
  allRdvs.forEach(r => {
    if (!r[3]) return;
    const d = new Date(r[3]);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const k = d.getDate();
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(r);
    }
  });

  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  let html = `<div class="cal-grid">${days.map(d => `<div class="cal-header-cell">${d}</div>`).join("")}`;
  for (let i = 0; i < start; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d = 1; d <= last.getDate(); d++) {
    const today = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
    const dr = byDay[d] || [];
    html += `<div class="cal-cell ${today ? "today" : ""}">
      <div class="cal-day-num">${d}</div>
      ${dr.slice(0, 3).map(r => {
        const safeR = JSON.stringify(r).replace(/'/g, "&#39;");
        return `<div class="cal-rdv-chip" style="cursor:pointer" onclick='openModal(${safeR})'>
          <span>${formatTime(r[3])}</span>${(r[5] || "Client").split(" ")[0]}
        </div>`;
      }).join("")}
      ${dr.length > 3 ? `<div class="cal-more">+${dr.length - 3}</div>` : ""}
    </div>`;
  }
  html += `</div>`;
  document.getElementById("cal-body").innerHTML = html;
}

// ── Load Data ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [ar, rr] = await Promise.all([fetchSheet(SHEETS.appels), fetchSheet(SHEETS.rdv)]);
    allAppels = ar.slice(1).filter(r => r[0]);
    allRdvs = rr.slice(1).filter(r => r[0]);
    const now = new Date();
    document.getElementById("periode").textContent = "Tableau de bord — " + now.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
    document.getElementById("last-update").textContent = "Mis à jour " + now.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
    renderDashboard();
    if (currentTab === "rdv") renderRdvFull("tous");
    if (currentTab === "messages") renderMessagesFull();
    if (currentTab === "appels") renderAppelsFull();
    if (currentTab === "calendrier") renderCalendar();
  } catch (e) {
    console.error("Erreur:", e);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(el => el.addEventListener("click", () => setTab(el.dataset.tab)));
  document.querySelectorAll(".filter-btn").forEach(b => b.addEventListener("click", () => renderRdvFull(b.dataset.filter)));
  document.getElementById("cal-prev").addEventListener("click", () => { currentCalMonth.setMonth(currentCalMonth.getMonth() - 1); renderCalendar(); });
  document.getElementById("cal-next").addEventListener("click", () => { currentCalMonth.setMonth(currentCalMonth.getMonth() + 1); renderCalendar(); });
  document.getElementById("modal-overlay").addEventListener("click", function(e) { if (e.target === this) closeModal(); });

  loadData();
  setInterval(loadData, 60000);
});
