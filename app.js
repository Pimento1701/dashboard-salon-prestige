const SHEET_ID = "1OXPJTOaH0YVXy8E-P909bVFCu8R6-1k2-XuTsFpFOJI";
const API_KEY = "AIzaSyAkLjqv-i5uCyXbUFoCiwMDBz12UgGeSYc";
const SHEETS = {
  appels: "APPELS",
  rdv: "RDV",
};

function formatDuree(secondes) {
  const s = parseInt(secondes) || 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffJ = Math.floor(diffH / 24);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `aujourd'hui ${d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffJ === 1) return "hier";
  return d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

function getTypeIcon(type) {
  if (type === "rdv") return { icon: "📅", cls: "icon-rdv" };
  if (type === "message") return { icon: "💬", cls: "icon-msg" };
  return { icon: "📞", cls: "icon-info" };
}

async function fetchSheet(sheetName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}!A:H?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.values || [];
}

async function loadDashboard() {
  try {
    const now = new Date();
    const moisNom = now.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
    document.getElementById("periode").textContent = `Tableau de bord — ${moisNom}`;

    // Charger les appels
    const appelsRows = await fetchSheet(SHEETS.appels);
    const appels = appelsRows.slice(1).filter(r => r[0]);

    // Stats du mois
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const appelsMois = appels.filter(r => new Date(r[0]) >= debutMois);
    const rdvMois = appelsMois.filter(r => r[2] === "rdv");
    const msgMois = appelsMois.filter(r => r[2] === "message");
    const durees = appelsMois.map(r => parseInt(r[1]) || 0).filter(d => d > 0);
    const dureeMoy = durees.length > 0 ? Math.round(durees.reduce((a, b) => a + b, 0) / durees.length) : 0;

    document.getElementById("stat-appels").textContent = appelsMois.length;
    document.getElementById("stat-rdv").textContent = rdvMois.length;
    document.getElementById("stat-duree").textContent = dureeMoy > 0 ? formatDuree(dureeMoy) : "—";
    document.getElementById("stat-messages").textContent = msgMois.length;

    // Derniers appels
    const derniersAppels = appels.slice(-10).reverse();
    const listeAppels = document.getElementById("liste-appels");
    if (derniersAppels.length === 0) {
      listeAppels.innerHTML = '<p class="empty">Aucun appel pour le moment</p>';
    } else {
      listeAppels.innerHTML = derniersAppels.map(r => {
        const { icon, cls } = getTypeIcon(r[2]);
        return `
          <div class="call-item">
            <div class="call-icon ${cls}">${icon}</div>
            <div style="flex:1;">
              <p class="call-name">${r[3] || "Inconnu"}</p>
              <p class="call-detail">${r[5] || "Appel"}</p>
            </div>
            <span class="call-time">${formatDate(r[0])}</span>
          </div>`;
      }).join("");
    }

    // Prochains RDV
    const rdvRows = await fetchSheet(SHEETS.rdv);
    const rdvs = rdvRows.slice(1)
      .filter(r => r[3] && new Date(r[3]) >= now)
      .sort((a, b) => new Date(a[3]) - new Date(b[3]))
      .slice(0, 5);

    const listeRdv = document.getElementById("liste-rdv");
    if (rdvs.length === 0) {
      listeRdv.innerHTML = '<p class="empty">Aucun RDV à venir</p>';
    } else {
      listeRdv.innerHTML = rdvs.map(r => {
        const dt = new Date(r[3]);
        const jour = dt.getDate();
        const mois = dt.toLocaleDateString("fr-CH", { month: "short" });
        const heure = dt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
        return `
          <div class="rdv-item">
            <div class="rdv-date">
              <div class="rdv-day">${jour}</div>
              <div class="rdv-month">${mois}</div>
            </div>
            <div style="flex:1;">
              <p class="rdv-name">${r[5] || "Client"}</p>
              <p class="rdv-service">${r[2]} — ${r[1]}</p>
            </div>
            <span class="rdv-heure">${heure}</span>
          </div>`;
      }).join("");
    }

    // Derniers messages
    const messages = appels.filter(r => r[2] === "message").slice(-5).reverse();
    const listeMsgs = document.getElementById("liste-messages");
    if (messages.length === 0) {
      listeMsgs.innerHTML = '<p class="empty">Aucun message pour le moment</p>';
    } else {
      listeMsgs.innerHTML = messages.map(r => `
        <div class="msg-item">
          <div class="msg-header">
            <span class="msg-name">${r[3] || "Inconnu"}</span>
            <span class="msg-time">${formatDate(r[0])}</span>
          </div>
          <p class="msg-text">${r[5] || ""}</p>
        </div>`
      ).join("");
    }

  } catch (e) {
    console.error("Erreur chargement dashboard:", e);
  }
}

loadDashboard();
setInterval(loadDashboard, 60000);
