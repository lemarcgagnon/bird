<?php

declare(strict_types=1);

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function dev_app_url(): string
{
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (str_starts_with($host, '127.0.0.1:8021') || str_starts_with($host, 'localhost:8021')) {
        return 'http://127.0.0.1:8016/app/index.html';
    }
    return '/app/index.html';
}

function money_cents(int $amountCents, string $currency): string
{
    $amount = number_format($amountCents / 100, 2, ',', ' ');
    return $amount . ' ' . strtoupper($currency);
}

const ADMIN_USER_STATUSES = [
    'pending' => 'En attente',
    'active' => 'Actif',
    'suspended' => 'Suspendu',
    'closed' => 'Archive',
];
const ADMIN_PLANS = ['none', 'credits', 'atelier', 'pro'];
const ADMIN_SUBSCRIPTION_STATUSES = ['none', 'active', 'past_due', 'canceled'];
const TICKET_STATUSES = ['open' => 'Ouvert', 'closed' => 'Ferme'];
const TICKET_PRIORITIES = ['low' => 'Basse', 'normal' => 'Normale', 'high' => 'Haute', 'urgent' => 'Urgente'];

function page_response(string $title, string $body, string $active = '', int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $appUrl = h(dev_app_url());
    $nav = [
        '/' => 'Accueil',
        '/pricing' => 'Offres',
        '/account' => 'Compte',
        '/admin' => 'Admin',
    ];
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . h($title) . ' - Nichoir</title>';
    echo '<style>';
    echo file_get_contents(__DIR__ . '/../public/site.css') ?: '';
    echo '</style></head><body>';
    echo '<header class="site-header"><a class="brand" href="/">Nichoir</a><nav>';
    foreach ($nav as $href => $label) {
        $class = $active === $href ? ' class="active"' : '';
        echo '<a' . $class . ' href="' . h($href) . '">' . h($label) . '</a>';
    }
    echo '<a class="button-link" href="' . $appUrl . '">Ouvrir app</a>';
    echo '</nav></header>';
    echo '<main>' . $body . '</main>';
    echo '<footer>Rust/WASM pour les plans et exports. PHP pour comptes, credits, admin et Stripe.</footer>';
    echo '<script>
      (() => {
        const tabNavs = document.querySelectorAll("[data-tab-nav]");
        if (!tabNavs.length) return;
        function activateTabs() {
          let hash = window.location.hash.replace("#", "");
          if (!hash && window.location.pathname === "/admin") {
            const params = new URLSearchParams(window.location.search);
            if (params.has("ticket_id")) hash = "admin-support";
            else if (params.has("user_id")) hash = params.get("return_tab") || "admin-clients";
          }
          tabNavs.forEach((nav) => {
            const tabs = Array.from(nav.querySelectorAll("[data-tab-target]"));
            const panels = tabs
              .map((tab) => document.getElementById(tab.dataset.tabTarget || ""))
              .filter(Boolean);
            const fallback = tabs[0]?.dataset.tabTarget || "";
            const active = panels.some((panel) => panel.id === hash) ? hash : fallback;
            tabs.forEach((tab) => {
              const selected = tab.dataset.tabTarget === active;
              tab.classList.toggle("active", selected);
              tab.setAttribute("aria-selected", selected ? "true" : "false");
            });
            panels.forEach((panel) => {
              panel.hidden = panel.id !== active;
            });
          });
        }
        document.addEventListener("click", (event) => {
          const tab = event.target.closest("[data-tab-target]");
          if (!tab) return;
          const target = tab.dataset.tabTarget || "";
          if (target) {
            event.preventDefault();
            history.replaceState(null, "", "#" + target);
            activateTabs();
          }
        });
        window.addEventListener("hashchange", activateTabs);
        activateTabs();

        document.querySelectorAll("[data-modal-tabs]").forEach((nav) => {
          const buttons = Array.from(nav.querySelectorAll("[data-modal-tab]"));
          const modal = nav.closest("[data-admin-modal]");
          const panels = modal ? Array.from(modal.querySelectorAll("[data-modal-panel]")) : [];
          const activateModalTab = (target) => {
            buttons.forEach((button) => {
              const selected = button.dataset.modalTab === target;
              button.classList.toggle("active", selected);
              button.setAttribute("aria-selected", selected ? "true" : "false");
            });
            panels.forEach((panel) => {
              panel.hidden = panel.dataset.modalPanel !== target;
            });
          };
          buttons.forEach((button) => {
            button.addEventListener("click", () => activateModalTab(button.dataset.modalTab || ""));
          });
          const initial = buttons.find((button) => button.classList.contains("active")) || buttons[0];
          if (initial) activateModalTab(initial.dataset.modalTab || "");
        });

        const modal = document.querySelector("[data-admin-modal]");
        if (modal) {
          const close = modal.querySelector("[data-modal-close]");
          if (close) close.focus();
          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal.dataset.closeUrl) {
              window.location.href = modal.dataset.closeUrl;
            }
          });
        }
      })();
    </script>';
    echo '</body></html>';
}

function render_landing_page(): void
{
    $appUrl = h(dev_app_url());
    page_response('Accueil', '
      <section class="hero">
        <p class="eyebrow">Conception parametrique</p>
        <h1>Nichoir</h1>
        <p>Un outil pour concevoir, visualiser et exporter des nichoirs en STL, ZIP panneaux et plans de coupe, avec calculs locaux dans le navigateur.</p>
        <div class="hero-actions">
          <a class="primary" href="' . $appUrl . '">Ouvrir l app</a>
          <a class="secondary" href="/pricing">Voir les offres</a>
        </div>
      </section>
      <section class="grid">
        <article><h2>WASM local</h2><p>La geometrie, les plans et les exports restent cote client pour eviter le calcul lourd serveur.</p></article>
        <article><h2>Credits</h2><p>Les telechargements premium passent par une autorisation courte et un debit de credits.</p></article>
        <article><h2>Fabrication</h2><p>Les panneaux, epaisseurs commerciales et traits de scie preparent une fabrication plus realiste.</p></article>
      </section>
    ', '/');
}

function render_pricing_page(): void
{
    page_response('Offres', '
      <section class="page-title">
        <p class="eyebrow">Credits et abonnements</p>
        <h1>Offres</h1>
        <p>Stripe est encore placeholder. Ces cartes fixent la structure produit avant Checkout et webhook.</p>
      </section>
      <section class="pricing-grid">
        <article><h2>Credits</h2><strong>A venir</strong><p>Achat ponctuel de credits pour STL, plans PDF, ZIP panneaux et exports image.</p></article>
        <article><h2>Atelier</h2><strong>A venir</strong><p>Abonnement pour usage regulier, historique de consommation et support prioritaire.</p></article>
        <article><h2>Pro</h2><strong>A venir</strong><p>Acces plus large, gestion multi-projets et limites commerciales plus hautes.</p></article>
      </section>
      <section class="panel"><h2>Couts dev actuels</h2><p>STL: 3 credits. PDF: 2 credits. ZIP: 5 credits. SVG/PNG: 1 credit.</p></section>
    ', '/pricing');
}

function render_account_page(): void
{
    page_response('Compte', '
      <section class="page-title">
        <p class="eyebrow">Espace client</p>
        <h1>Compte</h1>
        <p>Profil, credits, abonnement, factures et support tickets.</p>
      </section>
      <section class="panel account-panel">
        <div class="stat"><span>Etat</span><strong data-account-state>Non connecte</strong></div>
        <div class="stat"><span>Courriel</span><strong data-account-email>-</strong></div>
        <div class="stat"><span>Credits</span><strong data-account-credits>0</strong></div>
        <div class="stat"><span>Abonnement</span><strong data-account-plan>none</strong></div>
        <p data-account-message>Connecte-toi pour charger ton compte.</p>
      </section>
      <nav class="tab-nav" data-tab-nav role="tablist" aria-label="Sections compte">
        <a role="tab" aria-selected="true" data-tab-target="account-profile" href="#account-profile">Profil</a>
        <a role="tab" aria-selected="false" data-tab-target="account-billing" href="#account-billing">Billing</a>
        <a role="tab" aria-selected="false" data-tab-target="account-support" href="#account-support">Support</a>
        <a role="tab" aria-selected="false" data-tab-target="account-app" href="#account-app">App</a>
      </nav>

      <section class="tab-panel" id="account-profile" data-tab-panel>
        <section class="panel">
          <h2>Profil</h2>
          <form class="client-form profile-form" data-profile-form>
            <label><span>Nom</span><input name="display_name" type="text" maxlength="120"></label>
            <label><span>Courriel</span><input name="email" type="email" required></label>
            <label><span>Nouveau mot de passe</span><input name="password" type="password" minlength="8" maxlength="200" placeholder="laisser vide pour conserver"></label>
            <button type="submit">Enregistrer profil</button>
          </form>
        </section>

        <section class="account-grid">
        <div class="panel">
          <h2>Connexion</h2>
          <form class="client-form" data-login-form>
            <label><span>Courriel</span><input name="email" type="email" value="demo@nichoir.local" autocomplete="username" required></label>
            <label><span>Mot de passe</span><input name="password" type="password" value="password123" autocomplete="current-password" required></label>
            <div class="form-actions">
              <button type="submit">Connexion</button>
              <button type="button" data-demo-login>Demo</button>
              <button type="button" data-logout>Sortir</button>
            </div>
          </form>
        </div>
        <div class="panel">
          <h2>Inscription dev</h2>
          <form class="client-form" data-register-form>
            <label><span>Nom</span><input name="display_name" type="text" value="Demo" maxlength="120"></label>
            <label><span>Courriel</span><input name="email" type="email" placeholder="client@example.com" required></label>
            <label><span>Mot de passe</span><input name="password" type="password" minlength="8" maxlength="200" required></label>
            <button type="submit">Creer le compte</button>
          </form>
        </div>
        <div class="panel">
          <h2>Activation</h2>
          <form class="client-form" data-activation-form>
            <label><span>Courriel</span><input name="email" type="email" placeholder="client@example.com" required></label>
            <label><span>Code</span><input name="code" type="text" inputmode="numeric" minlength="6" maxlength="6" autocomplete="one-time-code" required></label>
            <div class="form-actions">
              <button type="submit">Activer</button>
              <button type="button" data-resend-activation>Renvoyer code</button>
            </div>
          </form>
        </div>
      </section>
      </section>

      <section class="tab-panel" id="account-billing" data-tab-panel hidden>
        <section class="panel">
          <h2>Historique credits</h2>
          <div class="table-wrap"><table><thead><tr><th>Delta</th><th>Raison</th><th>Reference</th><th>Date</th></tr></thead><tbody data-ledger-rows><tr><td colspan="4">Non connecte.</td></tr></tbody></table></div>
        </section>

        <section class="account-grid">
        <div class="panel">
          <h2>Abonnement</h2>
          <div class="client-summary compact">
            <div class="stat"><span>Plan</span><strong data-billing-plan>none</strong></div>
            <div class="stat"><span>Etat</span><strong data-billing-status>none</strong></div>
            <div class="stat"><span>Fin periode</span><strong data-billing-period>-</strong></div>
          </div>
        </div>
        <div class="panel">
          <h2>Stripe</h2>
          <p>Checkout, portail client et factures sont generes cote serveur avec Stripe.</p>
          <div class="form-actions billing-actions">
            <button type="button" data-billing-offer="credits">Credits</button>
            <button type="button" data-billing-offer="atelier">Atelier</button>
            <button type="button" data-billing-offer="pro">Pro</button>
            <button type="button" data-billing-portal>Portail Stripe</button>
          </div>
          <p data-checkout-message></p>
        </div>
      </section>

        <section class="panel">
          <h2>Factures et paiements</h2>
          <div class="table-wrap"><table><thead><tr><th>ID</th><th>Montant</th><th>Etat</th><th>Description</th><th>Facture</th><th>Date</th></tr></thead><tbody data-payment-rows><tr><td colspan="6">Non connecte.</td></tr></tbody></table></div>
        </section>
      </section>

      <section class="tab-panel panel support-panel" id="account-support" data-tab-panel hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Support</p>
            <h2>Tickets</h2>
          </div>
          <span class="section-hint">Creer, ouvrir le fil, repondre, fermer ou reouvrir.</span>
        </div>
        <div class="support-layout">
          <form class="client-form ticket-form support-compose" data-ticket-form>
            <h3>Nouveau ticket</h3>
            <label><span>Sujet</span><input name="subject" type="text" placeholder="Question sur un export" maxlength="140" required></label>
            <label><span>Message</span><textarea name="body" rows="4" placeholder="Decris le probleme ou la demande" maxlength="5000" required></textarea></label>
            <button type="submit">Envoyer ticket</button>
          </form>
          <div class="support-inbox">
            <h3>Mes demandes</h3>
            <div class="table-wrap"><table><thead><tr><th>ID</th><th>Sujet</th><th>Etat</th><th>Priorite</th><th>MAJ</th><th></th></tr></thead><tbody data-ticket-rows><tr><td colspan="6">Non connecte.</td></tr></tbody></table></div>
            <div class="ticket-detail" data-ticket-detail hidden>
              <div class="ticket-detail-header">
                <div>
                  <h3 data-ticket-title>Ticket</h3>
                  <p data-ticket-meta></p>
                </div>
                <button type="button" data-ticket-toggle-status>Changer statut</button>
              </div>
              <div class="ticket-thread" data-ticket-thread></div>
              <form class="client-form ticket-form" data-ticket-reply-form>
                <label><span>Reponse</span><textarea name="body" rows="3" maxlength="5000" required></textarea></label>
                <button type="submit">Repondre au fil</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section class="tab-panel grid" id="account-app" data-tab-panel hidden>
        <article><h2>App</h2><p>Les exports premium utilisent les credits visibles ici.</p></article>
        <article><h2>Serveur maitre</h2><p>Le compte, les credits, les abonnements, les paiements et les tickets viennent de PHP.</p></article>
        <article><h2>Stripe</h2><p>Le webhook remplira les paiements et mettra a jour l abonnement.</p></article>
      </section>

      <script>
      const TOKEN_KEY = "nichoir-auth-token";
      const demo = { email: "demo@nichoir.local", password: "password123" };
      let selectedTicketId = null;
      let selectedTicket = null;
      const token = () => localStorage.getItem(TOKEN_KEY);
      const setText = (selector, value) => document.querySelector(selector).textContent = value;
      const esc = (value) => String(value ?? "").replace(/[&<>"\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\x27": "&#39;" }[c]));
      const row = (cells) => `<tr>${cells.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`;

      async function api(path, options = {}) {
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        if (token()) headers.Authorization = `Bearer ${token()}`;
        const res = await fetch(path, { ...options, headers });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload.ok === false) throw new Error(payload.error || `api_${res.status}`);
        return payload;
      }

      function readableError(error) {
        const code = error?.message || String(error);
        const labels = {
          activation_unavailable: "Activation indisponible. Verifie SMTP dans Admin > Reglages.",
          activation_failed: "Activation refusee. Verifie le courriel/code ou renvoie un nouveau code.",
          too_many_requests: "Trop de tentatives. Attends quelques minutes puis reessaie.",
          invalid_credentials: "Connexion refusee. Verifie le mot de passe ou active le compte avec le code email.",
        };
        return labels[code] || code;
      }

      async function loadAccount() {
        const message = document.querySelector("[data-account-message]");
        if (!token()) {
          selectedTicketId = null;
          selectedTicket = null;
          setText("[data-account-state]", "Non connecte");
          setText("[data-account-email]", "-");
          setText("[data-account-credits]", "0");
          setText("[data-account-plan]", "none");
          document.querySelector("[data-profile-form]").reset();
          setText("[data-billing-plan]", "none");
          setText("[data-billing-status]", "none");
          setText("[data-billing-period]", "-");
          document.querySelector("[data-ledger-rows]").innerHTML = `<tr><td colspan="4">Non connecte.</td></tr>`;
          document.querySelector("[data-payment-rows]").innerHTML = `<tr><td colspan="6">Non connecte.</td></tr>`;
          document.querySelector("[data-ticket-rows]").innerHTML = `<tr><td colspan="6">Non connecte.</td></tr>`;
          renderTicketDetail(null);
          message.textContent = "Connecte-toi pour charger ton compte.";
          return;
        }
        try {
          const account = await api("/api/me");
          setText("[data-account-state]", account.user.status || "active");
          setText("[data-account-email]", account.user.email);
          setText("[data-account-credits]", account.user.credits);
          setText("[data-account-plan]", account.user.subscription_status);
          document.querySelector("[data-profile-form] [name=display_name]").value = account.user.display_name || "";
          document.querySelector("[data-profile-form] [name=email]").value = account.user.email || "";
          const ledger = await api("/api/credits/ledger");
          document.querySelector("[data-ledger-rows]").innerHTML = ledger.ledger.length
            ? ledger.ledger.map((item) => row([item.delta, item.reason, item.reference || "-", item.created_at])).join("")
            : `<tr><td colspan="4">Aucun mouvement.</td></tr>`;
          const billing = await api("/api/billing/summary");
          setText("[data-billing-plan]", billing.subscription.plan || "none");
          setText("[data-billing-status]", billing.subscription.status || "none");
          setText("[data-billing-period]", billing.subscription.current_period_end || "-");
          document.querySelector("[data-payment-rows]").innerHTML = billing.payments.length
            ? billing.payments.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(`${(item.amount_cents / 100).toFixed(2)} ${String(item.currency).toUpperCase()}`)}</td><td>${esc(item.status)}</td><td>${esc(item.description || "-")}</td><td>${item.invoice_url ? `<a href="${esc(item.invoice_url)}" target="_blank" rel="noreferrer">Voir</a>` : "-"} ${item.invoice_pdf ? `<a href="${esc(item.invoice_pdf)}" target="_blank" rel="noreferrer">PDF</a>` : ""}</td><td>${esc(item.created_at)}</td></tr>`).join("")
            : `<tr><td colspan="6">Aucun paiement synchronise.</td></tr>`;
          const tickets = await api("/api/tickets");
          renderTicketRows(tickets.tickets || []);
          message.textContent = "Compte charge.";
        } catch (err) {
          localStorage.removeItem(TOKEN_KEY);
          message.textContent = `Session invalide: ${err.message || err}`;
          await loadAccount();
        }
      }

      function renderTicketRows(tickets) {
        document.querySelector("[data-ticket-rows]").innerHTML = tickets.length
          ? tickets.map((item) => `<tr${Number(item.id) === Number(selectedTicketId) ? ` class="selected-row"` : ``}><td>#${esc(item.id)}</td><td>${esc(item.subject)}</td><td>${esc(item.status)}</td><td>${esc(item.priority || "normal")}</td><td>${esc(item.updated_at || item.created_at)}</td><td><button type="button" data-open-ticket="${esc(item.id)}">Ouvrir</button></td></tr>`).join("")
          : `<tr><td colspan="6">Aucun ticket.</td></tr>`;
        if (!tickets.some((item) => Number(item.id) === Number(selectedTicketId))) {
          selectedTicketId = tickets[0]?.id || null;
        }
        if (selectedTicketId) loadTicketDetail(selectedTicketId);
        else renderTicketDetail(null);
      }

      function renderTicketDetail(payload) {
        const box = document.querySelector("[data-ticket-detail]");
        if (!payload || !payload.ticket) {
          box.hidden = true;
          selectedTicket = null;
          return;
        }
        selectedTicket = payload.ticket;
        box.hidden = false;
        document.querySelector("[data-ticket-title]").textContent = `#${payload.ticket.id} - ${payload.ticket.subject}`;
        document.querySelector("[data-ticket-meta]").textContent = `Statut: ${payload.ticket.status} · Priorite: ${payload.ticket.priority || "normal"} · MAJ: ${payload.ticket.updated_at}`;
        document.querySelector("[data-ticket-toggle-status]").textContent = payload.ticket.status === "open" ? "Fermer" : "Reouvrir";
        document.querySelector("[data-ticket-reply-form]").hidden = payload.ticket.status !== "open";
        document.querySelector("[data-ticket-thread]").innerHTML = (payload.messages || []).length
          ? payload.messages.map((message) => `<article class="ticket-message ${esc(message.author_role || "client")}"><header><strong>${message.author_role === "admin" ? "Support" : "Client"}</strong><span>${esc(message.created_at)}</span></header><p>${esc(message.body).replace(/\\n/g, "<br>")}</p></article>`).join("")
          : `<p>Aucun message.</p>`;
      }

      async function loadTicketDetail(ticketId) {
        if (!ticketId || !token()) return;
        selectedTicketId = ticketId;
        try {
          renderTicketDetail(await api(`/api/tickets/${ticketId}`));
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Ticket introuvable: ${err.message || err}`;
        }
      }

      async function login(email, password) {
        const payload = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem(TOKEN_KEY, payload.token);
        await loadAccount();
      }

      document.querySelector("[data-login-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          await login(data.get("email"), data.get("password"));
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Connexion refusee: ${readableError(err)}`;
        }
      });

      document.querySelector("[data-register-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          const payload = await api("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
              email: data.get("email"),
              password: data.get("password"),
              display_name: data.get("display_name"),
            }),
          });
          document.querySelector("[data-activation-form] [name=email]").value = payload.email || data.get("email");
          document.querySelector("[data-activation-form] [name=code]").focus();
          document.querySelector("[data-account-message]").textContent = "Si inscription possible, un code activation est envoye par email.";
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Inscription refusee: ${readableError(err)}`;
        }
      });

      document.querySelector("[data-activation-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          const payload = await api("/api/auth/activate", {
            method: "POST",
            body: JSON.stringify({ email: data.get("email"), code: data.get("code") }),
          });
          localStorage.setItem(TOKEN_KEY, payload.token);
          event.currentTarget.reset();
          document.querySelector("[data-account-message]").textContent = "Compte active.";
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Activation refusee: ${readableError(err)}`;
        }
      });

      document.querySelector("[data-resend-activation]").addEventListener("click", async () => {
        const email = document.querySelector("[data-activation-form] [name=email]").value || document.querySelector("[data-register-form] [name=email]").value;
        try {
          await api("/api/auth/resend-activation", {
            method: "POST",
            body: JSON.stringify({ email }),
          });
          document.querySelector("[data-account-message]").textContent = "Si ce compte attend une activation, un nouveau code vient d etre envoye.";
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Renvoi refuse: ${readableError(err)}`;
        }
      });

      document.querySelector("[data-profile-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          const body = {
            display_name: data.get("display_name"),
            email: data.get("email"),
          };
          if (data.get("password")) body.password = data.get("password");
          await api("/api/profile", {
            method: "POST",
            body: JSON.stringify(body),
          });
          event.currentTarget.querySelector("[name=password]").value = "";
          document.querySelector("[data-account-message]").textContent = "Profil enregistre.";
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Profil refuse: ${err.message || err}`;
        }
      });

      document.querySelector("[data-demo-login]").addEventListener("click", () => login(demo.email, demo.password));
      document.querySelectorAll("[data-billing-offer]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const payload = await api("/api/checkout/stripe-link", {
              method: "POST",
              body: JSON.stringify({ offer: button.dataset.billingOffer }),
            });
            document.querySelector("[data-checkout-message]").textContent = `Redirection Checkout ${payload.offer}...`;
            window.location.href = payload.checkout_url;
          } catch (err) {
            document.querySelector("[data-checkout-message]").textContent = `Checkout refuse: ${err.message || err}`;
          }
        });
      });
      document.querySelector("[data-billing-portal]").addEventListener("click", async () => {
        try {
          const payload = await api("/api/billing/portal", { method: "POST" });
          document.querySelector("[data-checkout-message]").textContent = "Redirection portail Stripe...";
          window.location.href = payload.portal_url;
        } catch (err) {
          document.querySelector("[data-checkout-message]").textContent = `Portail refuse: ${err.message || err}`;
        }
      });
      document.querySelector("[data-logout]").addEventListener("click", async () => {
        try { if (token()) await api("/api/auth/logout", { method: "POST" }); } catch {}
        localStorage.removeItem(TOKEN_KEY);
        await loadAccount();
      });

      document.querySelector("[data-ticket-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          await api("/api/tickets", {
            method: "POST",
            body: JSON.stringify({ subject: data.get("subject"), body: data.get("body") }),
          });
          event.currentTarget.reset();
          selectedTicketId = null;
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Ticket refuse: ${err.message || err}`;
        }
      });

      document.querySelector("[data-ticket-rows]").addEventListener("click", async (event) => {
        const button = event.target.closest("[data-open-ticket]");
        if (!button) return;
        await loadTicketDetail(button.dataset.openTicket);
        await loadAccount();
      });

      document.querySelector("[data-ticket-reply-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!selectedTicketId) return;
        const data = new FormData(event.currentTarget);
        try {
          const payload = await api(`/api/tickets/${selectedTicketId}/messages`, {
            method: "POST",
            body: JSON.stringify({ body: data.get("body") }),
          });
          event.currentTarget.reset();
          renderTicketDetail(payload);
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Reponse refusee: ${err.message || err}`;
        }
      });

      document.querySelector("[data-ticket-toggle-status]").addEventListener("click", async () => {
        if (!selectedTicketId || !selectedTicket) return;
        const status = selectedTicket.status === "open" ? "closed" : "open";
        try {
          renderTicketDetail(await api(`/api/tickets/${selectedTicketId}/status`, {
            method: "POST",
            body: JSON.stringify({ status }),
          }));
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Statut refuse: ${err.message || err}`;
        }
      });

      loadAccount();
      </script>
    ', '/account');
}

function admin_summary(): array
{
    $pdo = db();
    return [
        'users' => (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(),
        'credits' => (int) $pdo->query('SELECT COALESCE(SUM(credits), 0) FROM users')->fetchColumn(),
        'exports' => (int) $pdo->query('SELECT COUNT(*) FROM export_authorizations')->fetchColumn(),
        'tickets' => (int) $pdo->query('SELECT COUNT(*) FROM tickets WHERE status = "open"')->fetchColumn(),
        'subscriptions' => (int) $pdo->query('SELECT COUNT(*) FROM subscriptions WHERE status = "active"')->fetchColumn(),
        'payments' => (int) $pdo->query('SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE status IN ("paid", "succeeded")')->fetchColumn(),
    ];
}

function is_local_request(): bool
{
    $addr = $_SERVER['REMOTE_ADDR'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return in_array($addr, ['127.0.0.1', '::1'], true)
        || str_starts_with($host, '127.0.0.1:')
        || str_starts_with($host, 'localhost:');
}

function admin_allowed(): bool
{
    $expected = (string) getenv('NICHOIR_ADMIN_KEY');
    if ($expected === '') {
        return is_local_request();
    }
    $provided = trim((string) ($_GET['key'] ?? ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '')));
    return $provided !== '' && hash_equals($expected, $provided);
}

function admin_key_input(): string
{
    $key = trim((string) ($_GET['key'] ?? ($_POST['key'] ?? '')));
    return $key === '' ? '' : '<input type="hidden" name="key" value="' . h($key) . '">';
}

function redirect_admin(int $userId = 0, string $notice = '', int $ticketId = 0): void
{
    $parts = [];
    if ($userId > 0) {
        $parts[] = 'user_id=' . $userId;
    }
    if ($ticketId > 0) {
        $parts[] = 'ticket_id=' . $ticketId;
    }
    $key = trim((string) ($_POST['key'] ?? ($_GET['key'] ?? '')));
    if ($key !== '') {
        $parts[] = 'key=' . rawurlencode($key);
    }
    if ($notice !== '') {
        $parts[] = 'notice=' . rawurlencode($notice);
    }
    header('Location: /admin' . ($parts ? '?' . implode('&', $parts) : ''));
}

function admin_redirect_url(array $params = []): string
{
    $key = trim((string) ($_POST['key'] ?? ($_GET['key'] ?? '')));
    if ($key !== '' && !isset($params['key'])) {
        $params['key'] = $key;
    }
    $query = http_build_query($params);
    return '/admin' . ($query === '' ? '' : '?' . $query);
}

function admin_tab_value(string $value, string $fallback = 'admin-clients'): string
{
    $allowed = ['admin-support', 'admin-clients', 'admin-billing', 'admin-exports', 'admin-logs', 'admin-settings'];
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function admin_client_panel_value(string $value): string
{
    $allowed = ['profile', 'credits', 'billing', 'exports'];
    return in_array($value, $allowed, true) ? $value : 'profile';
}

function admin_client_modal_url(int $userId, string $returnTab = 'admin-clients', string $panel = 'profile', array $extraParams = []): string
{
    $returnTab = admin_tab_value($returnTab);
    return admin_redirect_url(array_merge($extraParams, [
        'user_id' => $userId,
        'return_tab' => $returnTab,
        'client_panel' => admin_client_panel_value($panel),
    ])) . '#' . $returnTab;
}

function admin_export_scope_value(string $value): string
{
    $allowed = ['all', 'clients', 'billing', 'support', 'credits', 'exports'];
    return in_array($value, $allowed, true) ? $value : 'exports';
}

function admin_billing_scope_value(string $value): string
{
    $allowed = ['all', 'subscriptions', 'payments'];
    return in_array($value, $allowed, true) ? $value : 'all';
}

function admin_normalize_billing_filters(array $filters): array
{
    $scope = (string) ($filters['billing_scope'] ?? 'all');
    if ($scope === 'payments') {
        $filters['billing_plan'] = '';
        $filters['billing_subscription_status'] = '';
    } elseif ($scope === 'subscriptions') {
        $filters['billing_payment_status'] = '';
        $filters['billing_currency'] = '';
        $filters['billing_invoice'] = '';
        $filters['billing_amount_min'] = '';
        $filters['billing_amount_max'] = '';
    }
    return $filters;
}

function admin_date_filter_value(string $value): string
{
    $value = trim($value);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : '';
}

function admin_billing_filters(): array
{
    $amountMin = trim((string) ($_GET['billing_amount_min'] ?? ''));
    $amountMax = trim((string) ($_GET['billing_amount_max'] ?? ''));
    return admin_normalize_billing_filters([
        'billing_scope' => admin_billing_scope_value((string) ($_GET['billing_scope'] ?? 'all')),
        'billing_q' => substr(trim((string) ($_GET['billing_q'] ?? '')), 0, 120),
        'billing_plan' => substr(trim((string) ($_GET['billing_plan'] ?? '')), 0, 80),
        'billing_provider' => substr(trim((string) ($_GET['billing_provider'] ?? '')), 0, 80),
        'billing_subscription_status' => substr(trim((string) ($_GET['billing_subscription_status'] ?? '')), 0, 40),
        'billing_payment_status' => substr(trim((string) ($_GET['billing_payment_status'] ?? '')), 0, 40),
        'billing_currency' => substr(strtolower(trim((string) ($_GET['billing_currency'] ?? ''))), 0, 8),
        'billing_invoice' => in_array((string) ($_GET['billing_invoice'] ?? ''), ['yes', 'no'], true) ? (string) $_GET['billing_invoice'] : '',
        'billing_date_from' => admin_date_filter_value((string) ($_GET['billing_date_from'] ?? '')),
        'billing_date_to' => admin_date_filter_value((string) ($_GET['billing_date_to'] ?? '')),
        'billing_amount_min' => is_numeric($amountMin) ? $amountMin : '',
        'billing_amount_max' => is_numeric($amountMax) ? $amountMax : '',
    ]);
}

function admin_billing_filter_url(array $overrides = []): string
{
    $params = admin_normalize_billing_filters(array_merge(admin_billing_filters(), $overrides));
    foreach ($params as $key => $value) {
        if ($value === '' || $value === null) {
            unset($params[$key]);
        }
    }
    return admin_redirect_url($params) . '#admin-billing';
}

function admin_select_options(array $values, string $selected, string $emptyLabel = 'Tous'): string
{
    $html = '<option value="">' . h($emptyLabel) . '</option>';
    foreach ($values as $value => $label) {
        $optionValue = is_int($value) ? (string) $label : (string) $value;
        $optionLabel = is_int($value) ? (string) $label : (string) $label;
        $stringValue = trim($optionValue);
        $stringLabel = trim($optionLabel);
        if ($stringValue === '' || $stringLabel === '') {
            continue;
        }
        $html .= '<option value="' . h($stringValue) . '"' . ($selected === $stringValue ? ' selected' : '') . '>' . h($stringLabel) . '</option>';
    }
    return $html;
}

function admin_code_label(string $value): string
{
    $normalized = trim(strtolower($value));
    if ($normalized === '') {
        return '-';
    }
    return ucwords(str_replace('_', ' ', $normalized));
}

function admin_subscription_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'active' => 'Actif',
        'trialing' => 'Essai',
        'past_due' => 'En retard',
        'incomplete' => 'Incomplet',
        'canceled', 'cancelled' => 'Annule',
        'unpaid' => 'Impaye',
        'none' => 'Aucun',
        default => admin_code_label($status),
    };
}

function admin_payment_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'paid', 'succeeded' => 'Paye',
        'pending' => 'En attente',
        'processing' => 'En traitement',
        'requires_action' => 'Action requise',
        'failed' => 'Echec',
        'canceled', 'cancelled' => 'Annule',
        default => admin_code_label($status),
    };
}

function admin_provider_label(string $provider): string
{
    return match (strtolower(trim($provider))) {
        'stripe' => 'Stripe',
        default => admin_code_label($provider),
    };
}

function admin_billing_scope_nav(array $filters, int $subscriptionCount, int $paymentCount): string
{
    $current = (string) ($filters['billing_scope'] ?? 'all');
    $items = [
        'all' => ['Tout', $subscriptionCount + $paymentCount],
        'subscriptions' => ['Abonnements', $subscriptionCount],
        'payments' => ['Paiements', $paymentCount],
    ];
    $links = '';
    foreach ($items as $scope => [$label, $count]) {
        $class = 'log-scope-link' . ($current === $scope ? ' active' : '');
        $links .= '<a class="' . $class . '" href="' . h(admin_billing_filter_url(['billing_scope' => $scope])) . '"><span>' . h($label) . '</span><strong>' . (int) $count . '</strong></a>';
    }
    return '<nav class="log-scope-nav" aria-label="Portee billing">' . $links . '</nav>';
}

function admin_billing_filter_summary(array $filters): string
{
    $chips = [];
    $scope = (string) ($filters['billing_scope'] ?? 'all');
    $map = [
        'billing_q' => ['Recherche', static fn (string $value): string => $value],
        'billing_provider' => ['Provider', 'admin_provider_label'],
        'billing_date_from' => ['Depuis', static fn (string $value): string => $value],
        'billing_date_to' => ['Jusqu a', static fn (string $value): string => $value],
    ];
    if ($scope !== 'payments') {
        $map['billing_plan'] = ['Plan', static fn (string $value): string => $value];
        $map['billing_subscription_status'] = ['Etat abo', 'admin_subscription_status_label'];
    }
    if ($scope !== 'subscriptions') {
        $map['billing_payment_status'] = ['Etat paiement', 'admin_payment_status_label'];
        $map['billing_currency'] = ['Devise', 'strtoupper'];
        $map['billing_invoice'] = ['Facture', static fn (string $value): string => $value === 'yes' ? 'Avec facture' : 'Sans facture'];
        $map['billing_amount_min'] = ['Min', static fn (string $value): string => $value];
        $map['billing_amount_max'] = ['Max', static fn (string $value): string => $value];
    }
    foreach ($map as $key => $label) {
        $value = trim((string) ($filters[$key] ?? ''));
        if ($value !== '') {
            $chipLabel = is_array($label) ? (string) $label[0] : (string) $label;
            $formatter = is_array($label) ? $label[1] : static fn (string $item): string => $item;
            $display = is_callable($formatter) ? (string) $formatter($value) : $value;
            $chips[] = '<li class="filter-chip"><span>' . h($chipLabel) . '</span><strong>' . h($display) . '</strong></li>';
        }
    }
    if (!$chips) {
        return '<p class="section-hint">Vue standard du billing. Utilise la recherche, la periode et les statuts pour isoler un cas avant d ouvrir le detail client.</p>';
    }
    return '<ul class="filter-chip-list" aria-label="Filtres billing actifs">' . implode('', $chips) . '</ul>';
}

function admin_log_scope_value(string $value): string
{
    $allowed = ['all', 'application', 'audit', 'stripe'];
    return in_array($value, $allowed, true) ? $value : 'all';
}

function admin_log_filters(): array
{
    $httpStatus = trim((string) ($_GET['log_http_status'] ?? ''));
    $userId = trim((string) ($_GET['log_user_id'] ?? ''));
    $limit = (int) ($_GET['log_limit'] ?? 80);
    $limit = max(20, min(500, $limit));

    return [
        'log_scope' => admin_log_scope_value((string) ($_GET['log_scope'] ?? 'all')),
        'log_level' => trim((string) ($_GET['log_level'] ?? '')),
        'log_channel' => substr(trim((string) ($_GET['log_channel'] ?? '')), 0, 50),
        'log_event' => substr(trim((string) ($_GET['log_event'] ?? '')), 0, 100),
        'log_q' => substr(trim((string) ($_GET['log_q'] ?? '')), 0, 120),
        'log_date_from' => admin_date_filter_value((string) ($_GET['log_date_from'] ?? '')),
        'log_date_to' => admin_date_filter_value((string) ($_GET['log_date_to'] ?? '')),
        'log_user_id' => ctype_digit($userId) ? $userId : '',
        'log_http_status' => ctype_digit($httpStatus) ? $httpStatus : '',
        'log_request_id' => substr(trim((string) ($_GET['log_request_id'] ?? '')), 0, 64),
        'log_actor_role' => substr(trim((string) ($_GET['log_actor_role'] ?? '')), 0, 50),
        'log_action' => substr(trim((string) ($_GET['log_action'] ?? '')), 0, 100),
        'log_target_type' => substr(trim((string) ($_GET['log_target_type'] ?? '')), 0, 50),
        'log_outcome' => substr(trim((string) ($_GET['log_outcome'] ?? '')), 0, 32),
        'log_stripe_status' => substr(trim((string) ($_GET['log_stripe_status'] ?? '')), 0, 32),
        'log_stripe_type' => substr(trim((string) ($_GET['log_stripe_type'] ?? '')), 0, 255),
        'log_limit' => (string) $limit,
    ];
}

function admin_export_format_value(string $value): string
{
    $format = strtolower(trim($value));
    if ($format === 'excel') {
        return 'xls';
    }
    return in_array($format, ['csv', 'json', 'xls', 'sql'], true) ? $format : 'csv';
}

function admin_exports_download_url(string $format, string $scope = 'exports'): string
{
    $params = [
        'format' => admin_export_format_value($format),
        'scope' => admin_export_scope_value($scope),
    ];
    $key = trim((string) ($_GET['key'] ?? ($_POST['key'] ?? '')));
    if ($key !== '') {
        $params['key'] = $key;
    }
    return '/admin/exports/download?' . http_build_query($params);
}

function admin_export_dataset(string $label, array $columns, array $rows): array
{
    return [
        'label' => $label,
        'columns' => $columns,
        'rows' => $rows,
    ];
}

function admin_export_data(PDO $pdo): array
{
    $clients = $pdo->query(
        'SELECT created_at AS date, id AS user_id, email, display_name, credits, subscription_status, status, stripe_customer_id, created_at
         FROM users
         ORDER BY created_at DESC, id DESC'
    )->fetchAll();

    $billing = $pdo->query(
        "SELECT 'subscription' AS billing_type, subscriptions.id AS record_id, COALESCE(subscriptions.updated_at, subscriptions.created_at) AS date,
                users.id AS user_id, users.email, subscriptions.provider, subscriptions.plan, subscriptions.status,
                subscriptions.stripe_customer_id, subscriptions.stripe_subscription_id, subscriptions.stripe_price_id,
                NULL AS amount_cents, NULL AS currency, '' AS description, '' AS stripe_checkout_session_id,
                '' AS stripe_payment_intent_id, '' AS stripe_invoice_id, '' AS invoice_url, '' AS invoice_pdf,
                subscriptions.current_period_end, subscriptions.cancel_at_period_end, subscriptions.created_at, subscriptions.updated_at
         FROM subscriptions
         JOIN users ON users.id = subscriptions.user_id
         UNION ALL
         SELECT 'payment' AS billing_type, payments.id AS record_id, payments.created_at AS date,
                users.id AS user_id, users.email, payments.provider, '' AS plan, payments.status,
                payments.stripe_customer_id, '' AS stripe_subscription_id, '' AS stripe_price_id,
                payments.amount_cents, payments.currency, payments.description, payments.stripe_checkout_session_id,
                payments.stripe_payment_intent_id, payments.stripe_invoice_id, payments.invoice_url, payments.invoice_pdf,
                '' AS current_period_end, 0 AS cancel_at_period_end, payments.created_at, '' AS updated_at
         FROM payments
         JOIN users ON users.id = payments.user_id
         ORDER BY date DESC, record_id DESC"
    )->fetchAll();

    $credits = $pdo->query(
        'SELECT credit_ledger.created_at AS date, credit_ledger.id AS record_id, users.id AS user_id, users.email,
                credit_ledger.delta, credit_ledger.reason, credit_ledger.reference, credit_ledger.created_at
         FROM credit_ledger
         JOIN users ON users.id = credit_ledger.user_id
         ORDER BY credit_ledger.created_at DESC, credit_ledger.id DESC'
    )->fetchAll();

    $exports = $pdo->query(
        'SELECT export_authorizations.created_at AS date, export_authorizations.id AS record_id, users.id AS user_id, users.email,
                export_authorizations.export_type, export_authorizations.credit_cost, export_authorizations.status,
                export_authorizations.expires_at, export_authorizations.created_at, export_authorizations.consumed_at
         FROM export_authorizations
         JOIN users ON users.id = export_authorizations.user_id
         ORDER BY export_authorizations.created_at DESC, export_authorizations.id DESC'
    )->fetchAll();

    $support = $pdo->query(
        "SELECT 'ticket' AS support_type, tickets.id AS record_id, tickets.updated_at AS date, tickets.id AS ticket_id,
                users.id AS user_id, users.email, tickets.subject, tickets.status, tickets.priority, tickets.assigned_to,
                '' AS author_role, '' AS body, '' AS recipient, '' AS notification_status, '' AS error,
                tickets.created_at, tickets.updated_at, tickets.closed_at
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         UNION ALL
         SELECT 'message' AS support_type, ticket_messages.id AS record_id, ticket_messages.created_at AS date, tickets.id AS ticket_id,
                users.id AS user_id, users.email, tickets.subject, tickets.status, tickets.priority, tickets.assigned_to,
                ticket_messages.author_role, ticket_messages.body, '' AS recipient, '' AS notification_status, '' AS error,
                ticket_messages.created_at, '' AS updated_at, '' AS closed_at
         FROM ticket_messages
         JOIN tickets ON tickets.id = ticket_messages.ticket_id
         JOIN users ON users.id = ticket_messages.user_id
         UNION ALL
         SELECT 'notification' AS support_type, ticket_notifications.id AS record_id, ticket_notifications.created_at AS date, tickets.id AS ticket_id,
                users.id AS user_id, users.email, tickets.subject, tickets.status, tickets.priority, tickets.assigned_to,
                '' AS author_role, ticket_notifications.body, ticket_notifications.recipient, ticket_notifications.status AS notification_status,
                ticket_notifications.error, ticket_notifications.created_at, ticket_notifications.sent_at AS updated_at, '' AS closed_at
         FROM ticket_notifications
         JOIN tickets ON tickets.id = ticket_notifications.ticket_id
         JOIN users ON users.id = ticket_notifications.user_id
         ORDER BY date DESC, record_id DESC"
    )->fetchAll();

    $system = $pdo->query(
        "SELECT 'stripe_event' AS system_type, stripe_events.id AS record_id, stripe_events.created_at AS date,
                NULL AS user_id, '' AS email, stripe_events.event_id AS reference, stripe_events.type AS action,
                stripe_events.status, stripe_events.error, stripe_events.created_at, stripe_events.processed_at
         FROM stripe_events
         UNION ALL
         SELECT 'admin_audit' AS system_type, admin_audit_log.id AS record_id, admin_audit_log.created_at AS date,
                users.id AS user_id, COALESCE(users.email, '') AS email, '' AS reference, admin_audit_log.action,
                '' AS status, admin_audit_log.note AS error, admin_audit_log.created_at, '' AS processed_at
         FROM admin_audit_log
         LEFT JOIN users ON users.id = admin_audit_log.user_id
         ORDER BY date DESC, record_id DESC"
    )->fetchAll();

    return [
        'clients' => admin_export_dataset('Clients', ['date', 'user_id', 'email', 'display_name', 'credits', 'subscription_status', 'status', 'stripe_customer_id', 'created_at'], $clients),
        'billing' => admin_export_dataset('Billing', ['billing_type', 'record_id', 'date', 'user_id', 'email', 'provider', 'plan', 'status', 'amount_cents', 'currency', 'description', 'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id', 'stripe_checkout_session_id', 'stripe_payment_intent_id', 'stripe_invoice_id', 'invoice_url', 'invoice_pdf', 'current_period_end', 'cancel_at_period_end', 'created_at', 'updated_at'], $billing),
        'credits' => admin_export_dataset('Credits', ['date', 'record_id', 'user_id', 'email', 'delta', 'reason', 'reference', 'created_at'], $credits),
        'exports' => admin_export_dataset('Autorisations exports', ['date', 'record_id', 'user_id', 'email', 'export_type', 'credit_cost', 'status', 'expires_at', 'created_at', 'consumed_at'], $exports),
        'support' => admin_export_dataset('Support', ['support_type', 'record_id', 'date', 'ticket_id', 'user_id', 'email', 'subject', 'status', 'priority', 'assigned_to', 'author_role', 'body', 'recipient', 'notification_status', 'error', 'created_at', 'updated_at', 'closed_at'], $support),
        'system' => admin_export_dataset('Systeme', ['system_type', 'record_id', 'date', 'user_id', 'email', 'reference', 'action', 'status', 'error', 'created_at', 'processed_at'], $system),
    ];
}

function admin_export_value(array $row, string $key): string
{
    $value = $row[$key] ?? '';
    return $value === null ? '' : (string) $value;
}

function admin_export_timeline_rows(array $datasets): array
{
    $timeline = [];
    foreach ($datasets as $scope => $dataset) {
        foreach ($dataset['rows'] as $row) {
            $type = admin_export_value($row, 'billing_type')
                ?: admin_export_value($row, 'support_type')
                ?: admin_export_value($row, 'system_type')
                ?: admin_export_value($row, 'export_type')
                ?: admin_export_value($row, 'reason')
                ?: $scope;
            $timeline[] = [
                'section' => (string) $dataset['label'],
                'date' => admin_export_value($row, 'date') ?: admin_export_value($row, 'created_at'),
                'record_id' => admin_export_value($row, 'record_id') ?: admin_export_value($row, 'user_id'),
                'user_id' => admin_export_value($row, 'user_id'),
                'email' => admin_export_value($row, 'email'),
                'type' => $type,
                'status' => admin_export_value($row, 'status') ?: admin_export_value($row, 'notification_status'),
                'amount_cents' => admin_export_value($row, 'amount_cents'),
                'currency' => admin_export_value($row, 'currency'),
                'credit_delta' => admin_export_value($row, 'delta'),
                'description' => admin_export_value($row, 'description') ?: admin_export_value($row, 'subject') ?: admin_export_value($row, 'action') ?: admin_export_value($row, 'reference'),
                'metadata_json' => json_encode($row, JSON_UNESCAPED_SLASHES),
            ];
        }
    }
    usort($timeline, static fn (array $a, array $b): int => strcmp((string) $b['date'], (string) $a['date']));
    return $timeline;
}

function admin_export_selected_data(PDO $pdo, string $scope): array
{
    $datasets = admin_export_data($pdo);
    if ($scope === 'all') {
        return [
            'label' => 'Base complete',
            'filename' => 'base-complete',
            'datasets' => $datasets,
        ];
    }
    return [
        'label' => (string) $datasets[$scope]['label'],
        'filename' => $scope,
        'datasets' => [$scope => $datasets[$scope]],
    ];
}

function admin_export_send_csv(array $export, string $scope, string $filename): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    if ($out === false) {
        http_response_code(500);
        echo 'Unable to open output stream';
        return;
    }

    if ($scope === 'all') {
        $columns = ['section', 'date', 'record_id', 'user_id', 'email', 'type', 'status', 'amount_cents', 'currency', 'credit_delta', 'description', 'metadata_json'];
        fputcsv($out, $columns);
        foreach (admin_export_timeline_rows($export['datasets']) as $row) {
            fputcsv($out, array_map(static fn (string $column): string => admin_export_value($row, $column), $columns));
        }
        fclose($out);
        return;
    }

    $dataset = reset($export['datasets']);
    $columns = $dataset['columns'];
    fputcsv($out, $columns);
    foreach ($dataset['rows'] as $row) {
        fputcsv($out, array_map(static fn (string $column): string => admin_export_value($row, $column), $columns));
    }
    fclose($out);
}

function admin_export_send_json(array $export, string $filename): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $payload = [
        'label' => $export['label'],
        'generated_at' => (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
        'datasets' => [],
    ];
    foreach ($export['datasets'] as $key => $dataset) {
        $payload['datasets'][$key] = [
            'label' => $dataset['label'],
            'rows' => $dataset['rows'],
        ];
    }
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}

function admin_export_send_excel(array $export, string $filename): void
{
    header('Content-Type: application/vnd.ms-excel; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo '<!doctype html><html><head><meta charset="utf-8"></head><body>';
    echo '<h1>' . h((string) $export['label']) . '</h1>';
    echo '<p>Genere le ' . h((new DateTimeImmutable())->format('Y-m-d H:i:s')) . '</p>';
    foreach ($export['datasets'] as $dataset) {
        echo '<h2>' . h((string) $dataset['label']) . '</h2>';
        echo '<table border="1"><thead><tr>';
        foreach ($dataset['columns'] as $column) {
            echo '<th>' . h((string) $column) . '</th>';
        }
        echo '</tr></thead><tbody>';
        foreach ($dataset['rows'] as $row) {
            echo '<tr>';
            foreach ($dataset['columns'] as $column) {
                echo '<td>' . h(admin_export_value($row, (string) $column)) . '</td>';
            }
            echo '</tr>';
        }
        echo '</tbody></table>';
    }
    echo '</body></html>';
}

function handle_admin_exports_download(): void
{
    if (!admin_allowed()) {
        http_response_code(403);
        echo 'Forbidden';
        return;
    }

    $format = admin_export_format_value((string) ($_GET['format'] ?? 'csv'));
    $scope = admin_export_scope_value((string) ($_GET['scope'] ?? 'exports'));
    if (!in_array($format, ['csv', 'json', 'xls'], true)) {
        http_response_code(400);
        echo 'Invalid export format';
        return;
    }

    $export = admin_export_selected_data(db(), $scope);
    $filename = 'nichoir-' . $export['filename'] . '-' . (new DateTimeImmutable())->format('Ymd-His') . '.' . $format;

    if ($format === 'json') {
        admin_export_send_json($export, $filename);
        return;
    }
    if ($format === 'xls') {
        admin_export_send_excel($export, $filename);
        return;
    }
    admin_export_send_csv($export, $scope, $filename);
}

function admin_status_options(string $current): string
{
    $html = '';
    foreach (ADMIN_USER_STATUSES as $value => $label) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h($label) . '</option>';
    }
    return $html;
}

function admin_plan_options(string $current): string
{
    $html = '';
    foreach (ADMIN_PLANS as $option) {
        $selected = $current === $option ? ' selected' : '';
        $html .= '<option value="' . h($option) . '"' . $selected . '>' . h($option) . '</option>';
    }
    return $html;
}

function admin_subscription_status_options(string $current): string
{
    $html = '';
    foreach (ADMIN_SUBSCRIPTION_STATUSES as $option) {
        $selected = $current === $option ? ' selected' : '';
        $html .= '<option value="' . h($option) . '"' . $selected . '>' . h($option) . '</option>';
    }
    return $html;
}

function ticket_status_options(string $current): string
{
    $html = '';
    foreach (TICKET_STATUSES as $value => $label) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h($label) . '</option>';
    }
    return $html;
}

function ticket_priority_options(string $current): string
{
    $html = '';
    foreach (TICKET_PRIORITIES as $value => $label) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h($label) . '</option>';
    }
    return $html;
}

function admin_valid_ticket_status(string $status): bool
{
    return array_key_exists($status, TICKET_STATUSES);
}

function admin_valid_ticket_priority(string $priority): bool
{
    return array_key_exists($priority, TICKET_PRIORITIES);
}

function audit_admin_action(PDO $pdo, ?int $userId, string $action, ?int $delta, string $note): void
{
    $key = (string) ($_POST['key'] ?? ($_GET['key'] ?? 'local-dev'));
    $hash = $key === '' ? '' : hash('sha256', $key);
    $stmt = $pdo->prepare('INSERT INTO admin_audit_log (admin_key_hash, user_id, action, delta, note) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$hash, $userId, $action, $delta, $note]);
    if (function_exists('audit_log')) {
        audit_log($pdo, null, 'admin', $action, $userId === null ? '' : 'user', $userId === null ? '' : (string) $userId, 'success', '', [
            'delta' => $delta,
            'note' => $note,
        ]);
    }
}

function admin_load_user(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    return is_array($user) ? $user : null;
}

function admin_load_ticket(PDO $pdo, int $ticketId, int $userId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?');
    $stmt->execute([$ticketId, $userId]);
    $ticket = $stmt->fetch();
    return is_array($ticket) ? $ticket : null;
}

function admin_load_ticket_with_user(PDO $pdo, int $ticketId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT tickets.*, users.email, users.display_name, users.credits, users.status AS user_status
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         WHERE tickets.id = ?'
    );
    $stmt->execute([$ticketId]);
    $ticket = $stmt->fetch();
    return is_array($ticket) ? $ticket : null;
}

function admin_create_ticket_notification(PDO $pdo, array $ticket, array $user, string $subject, string $body): int
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '') {
        return 0;
    }
    return ticket_notification_create($pdo, (int) $ticket['id'], (int) $user['id'], $email, $subject, $body);
}

function admin_valid_user_status(string $status): bool
{
    return array_key_exists($status, ADMIN_USER_STATUSES);
}

function admin_valid_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false && strlen($email) <= 254;
}

function admin_valid_display_name(string $name): bool
{
    return strlen($name) <= 120;
}

function admin_valid_password(string $password): bool
{
    return string_length_between($password, 8, 200);
}

function admin_sync_user_state(PDO $pdo, int $userId, string $status): void
{
    if ($status === 'closed') {
        $pdo->prepare('UPDATE users SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP) WHERE id = ?')->execute([$userId]);
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);
        $pdo->prepare(
            "UPDATE export_authorizations
             SET status = CASE WHEN status = 'authorized' THEN 'revoked' ELSE status END,
                 consumed_at = CASE WHEN status = 'authorized' AND consumed_at IS NULL THEN CURRENT_TIMESTAMP ELSE consumed_at END
             WHERE user_id = ?"
        )->execute([$userId]);
        $pdo->prepare(
            "UPDATE tickets
             SET status = 'closed',
                 closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND status <> 'closed'"
        )->execute([$userId]);
        return;
    }

    $pdo->prepare('UPDATE users SET deleted_at = NULL WHERE id = ?')->execute([$userId]);
}

function admin_create_user(PDO $pdo): void
{
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $name = trim((string) ($_POST['display_name'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $credits = max(0, (int) ($_POST['credits'] ?? 0));
    $status = (string) ($_POST['status'] ?? 'active');
    if (!admin_valid_email($email) || !admin_valid_display_name($name) || !admin_valid_password($password) || !admin_valid_user_status($status)) {
        header('Location: ' . admin_redirect_url(['notice' => 'creation_invalide']));
        return;
    }
    $pdo->beginTransaction();
    try {
        $verifiedAt = $status === 'pending' ? null : (new DateTimeImmutable())->format('Y-m-d H:i:s');
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, credits, status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, $credits, $status, $verifiedAt]);
        $newUserId = (int) $pdo->lastInsertId();
        admin_sync_user_state($pdo, $newUserId, $status);
        if ($credits > 0) {
            $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
                ->execute([$newUserId, $credits, 'admin_create_user', 'initial']);
        }
        audit_admin_action($pdo, $newUserId, 'create_user', $credits, $email);
        $pdo->commit();
        redirect_admin($newUserId, 'client_cree');
    } catch (Throwable $e) {
        $pdo->rollBack();
        header('Location: ' . admin_redirect_url(['notice' => 'creation_erreur']));
    }
}

function admin_update_user(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $name = trim((string) ($_POST['display_name'] ?? ''));
    $status = (string) ($_POST['status'] ?? 'active');
    $credits = max(0, (int) ($_POST['credits'] ?? 0));
    if (!admin_valid_email($email) || !admin_valid_display_name($name) || !admin_valid_user_status($status)) {
        redirect_admin($userId, 'profil_invalide');
        return;
    }
    $delta = $credits - (int) $currentUser['credits'];
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE users
             SET email = ?,
                 display_name = ?,
                 status = ?,
                 credits = ?,
                 email_verified_at = CASE WHEN ? <> 'pending' AND email_verified_at IS NULL THEN CURRENT_TIMESTAMP ELSE email_verified_at END,
                 email_verification_code_hash = CASE WHEN ? <> 'pending' THEN '' ELSE email_verification_code_hash END,
                 email_verification_expires_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_expires_at END,
                 email_verification_sent_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_sent_at END
             WHERE id = ?"
        )->execute([$email, $name, $status, $credits, $status, $status, $status, $status, $userId]);
        admin_sync_user_state($pdo, $userId, $status);
        if ($delta !== 0) {
            $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
                ->execute([$userId, $delta, 'admin_set_balance', 'profile']);
        }
        audit_admin_action($pdo, $userId, 'update_user', $delta, $email);
        $pdo->commit();
        redirect_admin($userId, 'profil_modifie');
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'profil_erreur');
    }
}

function admin_reset_password(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $password = (string) ($_POST['password'] ?? '');
    if (!admin_valid_password($password)) {
        redirect_admin($userId, 'mot_de_passe_invalide');
        return;
    }
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
    audit_admin_action($pdo, $userId, 'reset_password', null, 'admin_reset');
    redirect_admin($userId, 'mot_de_passe_modifie');
}

function admin_delete_user(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $confirm = trim((string) ($_POST['confirm'] ?? ''));
    if ($confirm !== 'DELETE') {
        redirect_admin($userId, 'confirmation_requise');
        return;
    }
    $email = (string) $currentUser['email'];
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE users
             SET status = 'closed',
                 email_verification_code_hash = '',
                 email_verification_expires_at = NULL,
                 email_verification_sent_at = NULL
             WHERE id = ?"
        )->execute([$userId]);
        admin_sync_user_state($pdo, $userId, 'closed');
        audit_admin_action($pdo, $userId, 'soft_delete_user', null, $email);
        $pdo->commit();
        header('Location: ' . admin_redirect_url(['notice' => 'client_archive']));
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'suppression_erreur');
    }
}

function admin_adjust_credits(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $delta = (int) ($_POST['delta'] ?? 0);
    $note = trim((string) ($_POST['note'] ?? ''));
    if ($delta === 0) {
        redirect_admin($userId, 'delta_zero');
        return;
    }
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET credits = credits + ? WHERE id = ?')->execute([$delta, $userId]);
        $pdo->prepare('INSERT INTO credit_ledger (user_id, delta, reason, reference) VALUES (?, ?, ?, ?)')
            ->execute([$userId, $delta, 'admin_adjustment', $note]);
        audit_admin_action($pdo, $userId, 'adjust_credits', $delta, $note);
        $pdo->commit();
        redirect_admin($userId, 'credits_ajustes');
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_credits');
    }
}

function admin_set_status(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $status = (string) ($_POST['status'] ?? 'active');
    if (!in_array($status, ['pending', 'active', 'suspended', 'closed'], true)) {
        redirect_admin($userId, 'statut_invalide');
        return;
    }
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            "UPDATE users
             SET status = ?,
                 email_verified_at = CASE WHEN ? <> 'pending' AND email_verified_at IS NULL THEN CURRENT_TIMESTAMP ELSE email_verified_at END,
                 email_verification_code_hash = CASE WHEN ? <> 'pending' THEN '' ELSE email_verification_code_hash END,
                 email_verification_expires_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_expires_at END,
                 email_verification_sent_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_sent_at END
             WHERE id = ?"
        )->execute([$status, $status, $status, $status, $status, $userId]);
        admin_sync_user_state($pdo, $userId, $status);
        audit_admin_action($pdo, $userId, 'set_status', null, $status);
        $pdo->commit();
        redirect_admin($userId, 'statut_modifie');
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'statut_erreur');
    }
}

function admin_set_subscription(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $plan = (string) ($_POST['plan'] ?? 'none');
    $status = (string) ($_POST['subscription_status'] ?? 'none');
    if (!in_array($plan, ADMIN_PLANS, true) || !in_array($status, ADMIN_SUBSCRIPTION_STATUSES, true)) {
        redirect_admin($userId, 'abonnement_invalide');
        return;
    }
    $periodEnd = trim((string) ($_POST['current_period_end'] ?? ''));
    $periodEnd = $periodEnd === '' ? null : $periodEnd;
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET subscription_status = ? WHERE id = ?')->execute([$status, $userId]);
        $existing = $pdo->prepare('SELECT id FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1');
        $existing->execute([$userId]);
        $subscriptionId = $existing->fetchColumn();
        if ($subscriptionId) {
            $pdo->prepare('UPDATE subscriptions SET plan = ?, status = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                ->execute([$plan, $status, $periodEnd, (int) $subscriptionId]);
        } else {
            $pdo->prepare('INSERT INTO subscriptions (user_id, plan, status, current_period_end) VALUES (?, ?, ?, ?)')
                ->execute([$userId, $plan, $status, $periodEnd]);
        }
        audit_admin_action($pdo, $userId, 'set_subscription', null, $plan . ':' . $status);
        $pdo->commit();
        redirect_admin($userId, 'abonnement_modifie');
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_abonnement');
    }
}

function admin_reply_ticket(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $ticketId = (int) ($_POST['ticket_id'] ?? 0);
    $ticket = admin_load_ticket($pdo, $ticketId, $userId);
    if ($ticket === null) {
        redirect_admin($userId, 'ticket_introuvable');
        return;
    }
    if (($ticket['status'] ?? 'open') !== 'open') {
        redirect_admin($userId, 'ticket_ferme', $ticketId);
        return;
    }
    $body = trim((string) ($_POST['body'] ?? ''));
    if (!string_length_between($body, 1, 5000)) {
        redirect_admin($userId, 'message_ticket_invalide', $ticketId);
        return;
    }
    $notificationId = 0;
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO ticket_messages (ticket_id, user_id, author_role, body) VALUES (?, ?, ?, ?)')
            ->execute([$ticketId, $userId, 'admin', $body]);
        $pdo->prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$ticketId]);
        $notificationId = admin_create_ticket_notification($pdo, $ticket, $currentUser, 'Reponse support ticket #' . $ticketId, $body);
        audit_admin_action($pdo, $userId, 'reply_ticket', null, 'ticket #' . $ticketId);
        $pdo->commit();
        ticket_notification_send($pdo, $notificationId);
        redirect_admin($userId, 'reponse_ticket_envoyee', $ticketId);
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_ticket', $ticketId);
    }
}

function admin_set_ticket_status(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $ticketId = (int) ($_POST['ticket_id'] ?? 0);
    $ticket = admin_load_ticket($pdo, $ticketId, $userId);
    $status = strtolower(trim((string) ($_POST['ticket_status'] ?? '')));
    if ($ticket === null || !admin_valid_ticket_status($status)) {
        redirect_admin($userId, 'statut_ticket_invalide', $ticketId);
        return;
    }
    $closedAt = $status === 'closed' ? 'CURRENT_TIMESTAMP' : 'NULL';
    $notificationId = 0;
    $pdo->beginTransaction();
    try {
        $pdo->exec('UPDATE tickets SET status = ' . $pdo->quote($status) . ', updated_at = CURRENT_TIMESTAMP, closed_at = ' . $closedAt . ' WHERE id = ' . $ticketId);
        $notificationId = admin_create_ticket_notification(
            $pdo,
            $ticket,
            $currentUser,
            'Statut ticket #' . $ticketId . ': ' . $status,
            "Le statut de ton ticket #" . $ticketId . " est maintenant: " . $status . "."
        );
        audit_admin_action($pdo, $userId, 'set_ticket_status', null, 'ticket #' . $ticketId . ':' . $status);
        $pdo->commit();
        ticket_notification_send($pdo, $notificationId);
        redirect_admin($userId, 'statut_ticket_modifie', $ticketId);
    } catch (Throwable $e) {
        $pdo->rollBack();
        redirect_admin($userId, 'erreur_ticket', $ticketId);
    }
}

function admin_update_ticket_meta(PDO $pdo, array $currentUser): void
{
    $userId = (int) $currentUser['id'];
    $ticketId = (int) ($_POST['ticket_id'] ?? 0);
    $ticket = admin_load_ticket($pdo, $ticketId, $userId);
    $priority = strtolower(trim((string) ($_POST['priority'] ?? 'normal')));
    $assignedTo = trim((string) ($_POST['assigned_to'] ?? ''));
    if ($ticket === null || !admin_valid_ticket_priority($priority) || strlen($assignedTo) > 120) {
        redirect_admin($userId, 'meta_ticket_invalide', $ticketId);
        return;
    }
    $pdo->prepare('UPDATE tickets SET priority = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        ->execute([$priority, $assignedTo, $ticketId]);
    audit_admin_action($pdo, $userId, 'update_ticket_meta', null, 'ticket #' . $ticketId . ':' . $priority . ':' . $assignedTo);
    redirect_admin($userId, 'ticket_modifie', $ticketId);
}

function admin_update_email_settings(PDO $pdo): void
{
    $enabled = isset($_POST['smtp_enabled']) ? '1' : '0';
    $host = trim((string) ($_POST['smtp_host'] ?? ''));
    $port = (int) ($_POST['smtp_port'] ?? 587);
    $encryption = strtolower(trim((string) ($_POST['smtp_encryption'] ?? 'tls')));
    $username = trim((string) ($_POST['smtp_username'] ?? ''));
    $password = (string) ($_POST['smtp_password'] ?? '');
    $fromEmail = strtolower(trim((string) ($_POST['smtp_from_email'] ?? '')));
    $fromName = trim((string) ($_POST['smtp_from_name'] ?? 'Nichoir support'));
    $supportEmail = strtolower(trim((string) ($_POST['support_email'] ?? '')));

    if (!in_array($encryption, SMTP_ENCRYPTIONS, true) || $port <= 0 || $port > 65535) {
        header('Location: ' . admin_redirect_url(['notice' => 'smtp_invalide']));
        return;
    }
    if ($enabled === '1' && ($host === '' || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL) || !filter_var($supportEmail, FILTER_VALIDATE_EMAIL))) {
        header('Location: ' . admin_redirect_url(['notice' => 'smtp_champs_requis']));
        return;
    }

    setting_set($pdo, 'smtp_enabled', $enabled);
    setting_set($pdo, 'smtp_host', $host);
    setting_set($pdo, 'smtp_port', (string) $port);
    setting_set($pdo, 'smtp_encryption', $encryption);
    setting_set($pdo, 'smtp_username', $username);
    if ($password !== '') {
        setting_set($pdo, 'smtp_password', $password);
    }
    setting_set($pdo, 'smtp_from_email', $fromEmail);
    setting_set($pdo, 'smtp_from_name', substr($fromName, 0, 120));
    setting_set($pdo, 'support_email', $supportEmail);
    audit_admin_action($pdo, null, 'update_email_settings', null, $host . ':' . $port);
    header('Location: ' . admin_redirect_url(['notice' => 'smtp_modifie']));
}

function admin_send_test_email(PDO $pdo): void
{
    $recipient = strtolower(trim((string) ($_POST['test_recipient'] ?? '')));
    if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        header('Location: ' . admin_redirect_url(['notice' => 'email_test_invalide']));
        return;
    }
    try {
        smtp_send_email(
            $pdo,
            $recipient,
            'Test email Nichoir',
            "Ceci est un test SMTP depuis le panneau admin Nichoir.\n\nSi tu recois ce message, les coordonnees email sont valides."
        );
        audit_admin_action($pdo, null, 'send_test_email', null, $recipient);
        header('Location: ' . admin_redirect_url(['notice' => 'email_test_envoye']));
    } catch (Throwable $e) {
        audit_admin_action($pdo, null, 'send_test_email_failed', null, substr($e->getMessage(), 0, 200));
        header('Location: ' . admin_redirect_url(['notice' => 'email_test_erreur_' . substr(preg_replace('/[^a-z0-9_]+/i', '_', $e->getMessage()), 0, 80)]));
    }
}

function admin_update_stripe_settings(PDO $pdo): void
{
    $enabled = isset($_POST['stripe_enabled']) ? '1' : '0';
    $secretKey = trim((string) ($_POST['stripe_secret_key'] ?? ''));
    $webhookSecret = trim((string) ($_POST['stripe_webhook_secret'] ?? ''));
    $currency = strtolower(trim((string) ($_POST['stripe_currency'] ?? 'cad')));
    $priceCredits = trim((string) ($_POST['stripe_price_credits'] ?? ''));
    $priceAtelier = trim((string) ($_POST['stripe_price_atelier'] ?? ''));
    $pricePro = trim((string) ($_POST['stripe_price_pro'] ?? ''));
    $creditsQuantity = max(1, (int) ($_POST['stripe_credits_quantity'] ?? 50));

    if (!preg_match('/^[a-z]{3}$/', $currency)) {
        header('Location: ' . admin_redirect_url(['notice' => 'stripe_devise_invalide']));
        return;
    }
    if ($enabled === '1' && ($priceCredits === '' && $priceAtelier === '' && $pricePro === '')) {
        header('Location: ' . admin_redirect_url(['notice' => 'stripe_prix_requis']));
        return;
    }

    setting_set($pdo, 'stripe_enabled', $enabled);
    if ($secretKey !== '') {
        setting_set($pdo, 'stripe_secret_key', $secretKey);
    }
    if ($webhookSecret !== '') {
        setting_set($pdo, 'stripe_webhook_secret', $webhookSecret);
    }
    setting_set($pdo, 'stripe_currency', $currency);
    setting_set($pdo, 'stripe_price_credits', $priceCredits);
    setting_set($pdo, 'stripe_price_atelier', $priceAtelier);
    setting_set($pdo, 'stripe_price_pro', $pricePro);
    setting_set($pdo, 'stripe_credits_quantity', (string) $creditsQuantity);
    audit_admin_action($pdo, null, 'update_stripe_settings', null, $enabled . ':' . $currency);
    header('Location: ' . admin_redirect_url(['notice' => 'stripe_modifie']));
}

function admin_database_config_from_post(): array
{
    $local = db_local_config();
    $active = db_config();
    $driver = strtolower(trim((string) ($_POST['db_driver'] ?? $active['driver'])));
    $password = (string) ($_POST['mysql_password'] ?? '');
    if ($password === '') {
        $password = (string) ($local['mysql_password'] ?? '');
    }

    return db_normalize_config([
        'driver' => $driver,
        'sqlite_path' => trim((string) ($_POST['sqlite_path'] ?? $active['sqlite_path'])),
        'mysql_host' => trim((string) ($_POST['mysql_host'] ?? $active['mysql_host'])),
        'mysql_port' => trim((string) ($_POST['mysql_port'] ?? $active['mysql_port'])),
        'mysql_database' => trim((string) ($_POST['mysql_database'] ?? $active['mysql_database'])),
        'mysql_username' => trim((string) ($_POST['mysql_username'] ?? $active['mysql_username'])),
        'mysql_password' => $password,
        'mysql_charset' => trim((string) ($_POST['mysql_charset'] ?? $active['mysql_charset'])),
    ]);
}

function admin_handle_database_settings(PDO $pdo, bool $save): void
{
    $config = admin_database_config_from_post();
    if ($config['driver'] === 'mysql' && ($config['mysql_host'] === '' || $config['mysql_database'] === '' || $config['mysql_username'] === '')) {
        header('Location: ' . admin_redirect_url(['notice' => 'db_champs_requis']));
        return;
    }
    if ($config['driver'] === 'sqlite' && $config['sqlite_path'] === '') {
        header('Location: ' . admin_redirect_url(['notice' => 'db_sqlite_requis']));
        return;
    }

    try {
        db_test_config($config, $save);
        if ($save) {
            db_write_local_config($config);
            audit_admin_action(
                $pdo,
                null,
                'update_database_settings',
                null,
                $config['driver'] === 'mysql'
                    ? $config['mysql_host'] . ':' . $config['mysql_database']
                    : $config['sqlite_path']
            );
            header('Location: ' . admin_redirect_url(['notice' => 'db_modifie']) . '#admin-settings');
            return;
        }
        header('Location: ' . admin_redirect_url(['notice' => 'db_connexion_ok']) . '#admin-settings');
    } catch (Throwable $e) {
        audit_admin_action($pdo, null, 'database_settings_failed', null, substr($e->getMessage(), 0, 180));
        header('Location: ' . admin_redirect_url(['notice' => 'db_connexion_erreur']) . '#admin-settings');
    }
}

function handle_admin_post(): void
{
    if (!admin_allowed()) {
        if (function_exists('app_log')) {
            app_log(db(), 'security', 'admin', 'admin_access_denied', 'POST admin refuse', [], null, 403);
        }
        page_response('Admin', '<section class="page-title"><h1>Admin protege</h1><p>Acces refuse.</p></section>', '/admin', 403);
        return;
    }

    $action = (string) ($_POST['action'] ?? '');
    $pdo = db();

    if ($action === 'create_user') {
        admin_create_user($pdo);
        return;
    }
    if ($action === 'update_email_settings') {
        admin_update_email_settings($pdo);
        return;
    }
    if ($action === 'send_test_email') {
        admin_send_test_email($pdo);
        return;
    }
    if ($action === 'update_stripe_settings') {
        admin_update_stripe_settings($pdo);
        return;
    }
    if ($action === 'test_database_settings') {
        admin_handle_database_settings($pdo, false);
        return;
    }
    if ($action === 'update_database_settings') {
        admin_handle_database_settings($pdo, true);
        return;
    }

    $userId = (int) ($_POST['user_id'] ?? 0);
    if ($userId <= 0) {
        redirect_admin(0, 'client_invalide');
        return;
    }
    $currentUser = admin_load_user($pdo, $userId);
    if ($currentUser === null) {
        redirect_admin(0, 'client_introuvable');
        return;
    }

    match ($action) {
        'update_user' => admin_update_user($pdo, $currentUser),
        'reset_password' => admin_reset_password($pdo, $currentUser),
        'delete_user' => admin_delete_user($pdo, $currentUser),
        'adjust_credits' => admin_adjust_credits($pdo, $currentUser),
        'set_status' => admin_set_status($pdo, $currentUser),
        'set_subscription' => admin_set_subscription($pdo, $currentUser),
        'reply_ticket' => admin_reply_ticket($pdo, $currentUser),
        'set_ticket_status' => admin_set_ticket_status($pdo, $currentUser),
        'update_ticket_meta' => admin_update_ticket_meta($pdo, $currentUser),
        default => redirect_admin($userId, 'action_inconnue'),
    };
}

function selected_admin_user(PDO $pdo): ?array
{
    $userId = (int) ($_GET['user_id'] ?? 0);
    if ($userId > 0) {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        return is_array($user) ? $user : null;
    }
    return null;
}

function render_create_user_panel(): string
{
    return '
      <section class="panel">
        <h2>Creer utilisateur</h2>
        <form class="admin-create-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="create_user">
          <label><span>Courriel</span><input type="email" name="email" required></label>
          <label><span>Nom</span><input type="text" name="display_name"></label>
          <label><span>Mot de passe initial</span><input type="password" name="password" minlength="8" required></label>
          <label><span>Credits initiaux</span><input type="number" name="credits" min="0" step="1" value="0"></label>
          <label><span>Statut</span><select name="status">' . admin_status_options('active') . '</select></label>
          <button type="submit">Creer</button>
        </form>
      </section>
    ';
}

function admin_directory_link(array $overrides): string
{
    $params = [
        'q' => trim((string) ($_GET['q'] ?? '')),
        'status' => trim((string) ($_GET['status'] ?? '')),
        'subscription_status' => trim((string) ($_GET['subscription_status'] ?? '')),
        'page' => (string) max(1, (int) ($_GET['page'] ?? 1)),
    ];
    foreach ($overrides as $key => $value) {
        $params[$key] = (string) $value;
    }
    foreach ($params as $key => $value) {
        if ($value === '') {
            unset($params[$key]);
        }
    }
    return admin_redirect_url($params);
}

function render_user_directory(PDO $pdo): string
{
    $query = strtolower(trim((string) ($_GET['q'] ?? '')));
    $status = trim((string) ($_GET['status'] ?? ''));
    $subscriptionStatus = trim((string) ($_GET['subscription_status'] ?? ''));
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = 25;
    $offset = ($page - 1) * $perPage;
    $where = [];
    $params = [];

    if ($query !== '') {
        if (ctype_digit($query)) {
            $where[] = '(id = ? OR lower(email) LIKE ? OR lower(display_name) LIKE ?)';
            $params[] = (int) $query;
            $params[] = '%' . $query . '%';
            $params[] = '%' . $query . '%';
        } else {
            $where[] = '(lower(email) LIKE ? OR lower(display_name) LIKE ?)';
            $params[] = '%' . $query . '%';
            $params[] = '%' . $query . '%';
        }
    }
    if (admin_valid_user_status($status)) {
        $where[] = 'status = ?';
        $params[] = $status;
    }
    if (in_array($subscriptionStatus, ADMIN_SUBSCRIPTION_STATUSES, true)) {
        $where[] = 'subscription_status = ?';
        $params[] = $subscriptionStatus;
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM users ' . $whereSql);
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT id, email, display_name, credits, subscription_status, status, created_at FROM users ' . $whereSql . ' ORDER BY id DESC LIMIT ? OFFSET ?');
    $stmtParams = $params;
    $stmtParams[] = $perPage;
    $stmtParams[] = $offset;
    $stmt->execute($stmtParams);

    $rows = '';
    foreach ($stmt->fetchAll() as $user) {
        $href = admin_client_modal_url((int) $user['id'], 'admin-clients', 'profile');
        $rows .= '<tr><td><a href="' . h($href) . '">' . (int) $user['id'] . '</a></td><td><a href="' . h($href) . '">' . h((string) $user['email']) . '</a></td><td>' . h((string) $user['display_name']) . '</td><td>' . (int) $user['credits'] . '</td><td>' . h((string) $user['subscription_status']) . '</td><td>' . h((string) ($user['status'] ?? 'active')) . '</td><td>' . h((string) $user['created_at']) . '</td><td><a href="' . h($href) . '">Ouvrir</a></td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="8">Aucun utilisateur trouve.</td></tr>';

    $start = $total === 0 ? 0 : $offset + 1;
    $end = min($offset + $perPage, $total);
    $prev = $page > 1 ? '<a class="secondary" href="' . h(admin_directory_link(['page' => $page - 1])) . '">Precedent</a>' : '';
    $next = $end < $total ? '<a class="secondary" href="' . h(admin_directory_link(['page' => $page + 1])) . '">Suivant</a>' : '';

    return '
      <section class="panel">
        <h2>Repertoire utilisateurs</h2>
        <form class="admin-directory-form" method="get" action="/admin">
          ' . admin_key_input() . '
          <label><span>Recherche</span><input type="search" name="q" value="' . h((string) ($_GET['q'] ?? '')) . '" placeholder="id, courriel ou nom"></label>
          <label><span>Statut</span><select name="status"><option value="">Tous</option>' . admin_status_options($status) . '</select></label>
          <label><span>Abonnement</span><select name="subscription_status"><option value="">Tous</option>' . admin_subscription_status_options($subscriptionStatus) . '</select></label>
          <button type="submit">Filtrer</button>
        </form>
        <p class="directory-count">' . $start . '-' . $end . ' sur ' . $total . ' utilisateur(s)</p>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Courriel</th><th>Nom</th><th>Credits</th><th>Abonnement</th><th>Statut</th><th>Cree</th><th></th></tr></thead><tbody>' . $rows . '</tbody></table></div>
        <div class="pagination">' . $prev . $next . '</div>
      </section>
    ';
}

function render_open_tickets_panel(PDO $pdo): string
{
    $stmt = $pdo->query(
        'SELECT tickets.id, tickets.user_id, tickets.subject, tickets.priority, tickets.updated_at, users.email
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         WHERE tickets.status = "open"
         ORDER BY tickets.updated_at DESC, tickets.id DESC
         LIMIT 12'
    );
    $rows = '';
    foreach ($stmt->fetchAll() as $ticket) {
        $href = admin_redirect_url(['ticket_id' => (int) $ticket['id']]) . '#admin-support';
        $clientHref = admin_client_modal_url((int) $ticket['user_id'], 'admin-support', 'profile');
        $rows .= '<tr><td><a href="' . h($href) . '">#' . (int) $ticket['id'] . '</a></td><td><a href="' . h($clientHref) . '">' . h((string) $ticket['email']) . '</a></td><td>' . h((string) $ticket['subject']) . '</td><td>' . h((string) $ticket['priority']) . '</td><td>' . h((string) $ticket['updated_at']) . '</td><td><a class="secondary compact-link" href="' . h($href) . '">Ouvrir et repondre</a></td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="6">Aucun ticket ouvert.</td></tr>';

    return '
      <section class="panel" id="support-queue">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Support</p>
            <h2>Tickets ouverts</h2>
          </div>
          <span class="section-hint">Ouvre un ticket pour voir le fil complet et repondre au client.</span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Sujet</th><th>Priorite</th><th>MAJ</th><th></th></tr></thead><tbody>' . $rows . '</tbody></table></div>
      </section>
    ';
}

function render_admin_support_panel(PDO $pdo): string
{
    return render_open_tickets_panel($pdo);
}

function render_client_profile_panel(?array $user): string
{
    if ($user === null) {
        return '<section class="panel"><h2>Fiche client</h2><p>Selectionne un client dans le repertoire.</p></section>';
    }

    $userId = (int) $user['id'];
    $status = (string) ($user['status'] ?? 'active');
    $deletedAt = (string) ($user['deleted_at'] ?? '');
    $nextStatus = $status === 'active' ? 'suspended' : 'active';
    $nextLabel = $nextStatus === 'active' ? 'Reactiver' : 'Suspendre';

    return '
      <section class="panel client-detail">
        <h2>Fiche client</h2>
        <div class="client-summary">
          <div class="stat"><span>ID</span><strong>' . $userId . '</strong></div>
          <div class="stat"><span>Courriel</span><strong>' . h((string) $user['email']) . '</strong></div>
          <div class="stat"><span>Credits</span><strong>' . (int) $user['credits'] . '</strong></div>
          <div class="stat"><span>Statut</span><strong>' . h($status) . '</strong></div>
          ' . ($deletedAt !== '' ? '<div class="stat"><span>Archive le</span><strong>' . h($deletedAt) . '</strong></div>' : '') . '
        </div>
        <div class="admin-actions">
          <form class="span-all admin-profile-form" method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="update_user">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <input type="hidden" name="credits" value="' . (int) $user['credits'] . '">
            <label><span>Courriel</span><input type="email" name="email" value="' . h((string) $user['email']) . '" required></label>
            <label><span>Nom</span><input type="text" name="display_name" value="' . h((string) $user['display_name']) . '"></label>
            <label><span>Statut</span><select name="status">' . admin_status_options($status) . '</select></label>
            <button type="submit">Enregistrer profil</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="reset_password">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <label><span>Nouveau mot de passe</span><input type="password" name="password" minlength="8" required></label>
            <button type="submit">Reset mot de passe</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="set_status">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <input type="hidden" name="status" value="' . h($nextStatus) . '">
            <button type="submit">' . h($nextLabel) . '</button>
          </form>
          <form class="span-all danger-form" method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="delete_user">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <label><span>Archivage avec retention</span><input type="text" name="confirm" placeholder="taper DELETE pour confirmer"></label>
            <button type="submit">Archiver utilisateur</button>
          </form>
        </div>
      </section>
    ';
}

function render_client_credits_panel(PDO $pdo, ?array $user): string
{
    if ($user === null) {
        return '<section class="panel"><h2>Credits client</h2><p>Selectionne un client dans l onglet Clients.</p></section>';
    }
    $userId = (int) $user['id'];
    $ledger = $pdo->prepare('SELECT delta, reason, reference, created_at FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50');
    $ledger->execute([$userId]);
    $rows = '';
    foreach ($ledger->fetchAll() as $row) {
        $rows .= '<tr><td>' . (int) $row['delta'] . '</td><td>' . h((string) $row['reason']) . '</td><td>' . h((string) $row['reference']) . '</td><td>' . h((string) $row['created_at']) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="4">Aucune entree.</td></tr>';

    return '
      <section class="panel">
        <h2>Credits client</h2>
        <div class="client-summary compact">
          <div class="stat"><span>Client</span><strong>' . h((string) $user['email']) . '</strong></div>
          <div class="stat"><span>Solde</span><strong>' . (int) $user['credits'] . '</strong></div>
          <div class="stat"><span>Statut</span><strong>' . h((string) ($user['status'] ?? 'active')) . '</strong></div>
        </div>
        <form class="admin-directory-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="adjust_credits">
          <input type="hidden" name="user_id" value="' . $userId . '">
          <label><span>Ajustement credits</span><input type="number" name="delta" step="1" required></label>
          <label><span>Note</span><input type="text" name="note" placeholder="raison interne"></label>
          <button type="submit">Appliquer</button>
        </form>
      </section>
      <section class="panel"><h2>Historique credits</h2><div class="table-wrap"><table><thead><tr><th>Delta</th><th>Raison</th><th>Reference</th><th>Date</th></tr></thead><tbody>' . $rows . '</tbody></table></div></section>
    ';
}

function render_admin_modal_shell(string $title, string $closeUrl, string $body): string
{
    return '
      <div class="admin-modal-backdrop" data-admin-modal data-close-url="' . h($closeUrl) . '">
        <article class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <header class="admin-modal-header">
            <h2 id="admin-modal-title">' . h($title) . '</h2>
            <a class="secondary compact-link" href="' . h($closeUrl) . '" data-modal-close>Fermer</a>
          </header>
          <div class="admin-modal-body">' . $body . '</div>
        </article>
      </div>
    ';
}

function render_client_billing_detail_panel(PDO $pdo, array $user): string
{
    $userId = (int) $user['id'];
    $subscriptions = $pdo->prepare('SELECT plan, status, provider, current_period_end, cancel_at_period_end, updated_at FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 10');
    $subscriptions->execute([$userId]);
    $payments = $pdo->prepare('SELECT id, amount_cents, currency, status, description, invoice_url, invoice_pdf, created_at FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 20');
    $payments->execute([$userId]);
    $subscriptionItems = $subscriptions->fetchAll();
    $latestSubscription = $subscriptionItems[0] ?? [
        'plan' => 'none',
        'status' => (string) ($user['subscription_status'] ?? 'none'),
        'current_period_end' => '',
    ];
    $subscriptionRows = '';
    foreach ($subscriptionItems as $row) {
        $subscriptionRows .= '<tr><td>' . h((string) $row['plan']) . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) $row['provider']) . '</td><td>' . h((string) ($row['current_period_end'] ?: '-')) . '</td><td>' . ((int) $row['cancel_at_period_end'] === 1 ? 'oui' : 'non') . '</td><td>' . h((string) $row['updated_at']) . '</td></tr>';
    }
    $subscriptionRows = $subscriptionRows ?: '<tr><td colspan="6">Aucun abonnement synchronise.</td></tr>';
    $paymentRows = '';
    foreach ($payments->fetchAll() as $row) {
        $invoiceLinks = ((string) $row['invoice_url'] !== '' ? '<a href="' . h((string) $row['invoice_url']) . '" target="_blank" rel="noreferrer">Voir</a> ' : '')
            . ((string) $row['invoice_pdf'] !== '' ? '<a href="' . h((string) $row['invoice_pdf']) . '" target="_blank" rel="noreferrer">PDF</a>' : '');
        $paymentRows .= '<tr><td>' . (int) $row['id'] . '</td><td>' . h(money_cents((int) $row['amount_cents'], (string) $row['currency'])) . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) $row['description']) . '</td><td>' . ($invoiceLinks ?: '-') . '</td><td>' . h((string) $row['created_at']) . '</td></tr>';
    }
    $paymentRows = $paymentRows ?: '<tr><td colspan="6">Aucun paiement synchronise.</td></tr>';
    $periodValue = h(substr((string) ($latestSubscription['current_period_end'] ?? ''), 0, 10));

    return '
      <section class="modal-section">
        <h3>Abonnement</h3>
        <form class="admin-directory-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="set_subscription">
          <input type="hidden" name="user_id" value="' . $userId . '">
          <label><span>Plan</span><select name="plan">' . admin_plan_options((string) $latestSubscription['plan']) . '</select></label>
          <label><span>Etat abonnement</span><select name="subscription_status">' . admin_subscription_status_options((string) $latestSubscription['status']) . '</select></label>
          <label><span>Fin periode</span><input type="date" name="current_period_end" value="' . $periodValue . '"></label>
          <button type="submit">Mettre a jour abonnement</button>
        </form>
      </section>
      <section class="modal-section"><h3>Historique abonnements</h3><div class="table-wrap"><table><thead><tr><th>Plan</th><th>Etat</th><th>Provider</th><th>Fin periode</th><th>Annule fin</th><th>MAJ</th></tr></thead><tbody>' . $subscriptionRows . '</tbody></table></div></section>
      <section class="modal-section"><h3>Paiements</h3><div class="table-wrap"><table><thead><tr><th>ID</th><th>Montant</th><th>Etat</th><th>Description</th><th>Facture</th><th>Date</th></tr></thead><tbody>' . $paymentRows . '</tbody></table></div></section>
    ';
}

function render_client_exports_detail_panel(PDO $pdo, array $user): string
{
    $exports = $pdo->prepare('SELECT export_type, credit_cost, status, created_at, consumed_at FROM export_authorizations WHERE user_id = ? ORDER BY id DESC LIMIT 50');
    $exports->execute([(int) $user['id']]);
    $rows = '';
    foreach ($exports->fetchAll() as $row) {
        $rows .= '<tr><td>' . h((string) $row['export_type']) . '</td><td>' . (int) $row['credit_cost'] . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) $row['created_at']) . '</td><td>' . h((string) ($row['consumed_at'] ?: '-')) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="5">Aucun export.</td></tr>';
    return '<section class="modal-section"><h3>Exports client</h3><div class="table-wrap"><table><thead><tr><th>Type</th><th>Cout</th><th>Etat</th><th>Cree</th><th>Consomme</th></tr></thead><tbody>' . $rows . '</tbody></table></div></section>';
}

function render_client_modal(PDO $pdo, array $user, string $closeUrl, string $activePanel): string
{
    $title = 'Client #' . (int) $user['id'] . ' - ' . (string) $user['email'];
    $profile = render_client_profile_panel($user);
    $credits = render_client_credits_panel($pdo, $user);
    $billing = render_client_billing_detail_panel($pdo, $user);
    $exports = render_client_exports_detail_panel($pdo, $user);
    $tabs = [
        'client-profile' => 'Profil',
        'client-credits' => 'Credits',
        'client-billing' => 'Billing',
        'client-exports' => 'Exports',
    ];
    if (!array_key_exists($activePanel, $tabs)) {
        $activePanel = 'client-profile';
    }
    $tabButtons = '';
    foreach ($tabs as $panel => $label) {
        $active = $panel === $activePanel;
        $tabButtons .= '<button type="button"' . ($active ? ' class="active"' : '') . ' data-modal-tab="' . h($panel) . '" role="tab" aria-selected="' . ($active ? 'true' : 'false') . '">' . h($label) . '</button>';
    }
    return render_admin_modal_shell($title, $closeUrl, '
      <nav class="modal-tab-nav" data-modal-tabs role="tablist" aria-label="Sections client">
        ' . $tabButtons . '
      </nav>
      <div data-modal-panel="client-profile"' . ($activePanel === 'client-profile' ? '' : ' hidden') . '>' . $profile . '</div>
      <div data-modal-panel="client-credits"' . ($activePanel === 'client-credits' ? '' : ' hidden') . '>' . $credits . '</div>
      <div data-modal-panel="client-billing"' . ($activePanel === 'client-billing' ? '' : ' hidden') . '>' . $billing . '</div>
      <div data-modal-panel="client-exports"' . ($activePanel === 'client-exports' ? '' : ' hidden') . '>' . $exports . '</div>
    ');
}

function render_ticket_modal(PDO $pdo, int $ticketId): string
{
    $ticket = admin_load_ticket_with_user($pdo, $ticketId);
    if ($ticket === null) {
        return '';
    }
    $messageStmt = $pdo->prepare('SELECT author_role, body, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC');
    $messageStmt->execute([(int) $ticket['id']]);
    $messageRows = '';
    foreach ($messageStmt->fetchAll() as $message) {
        $role = (string) ($message['author_role'] ?: 'client');
        $messageRows .= '<article class="ticket-message ' . h($role) . '"><header><strong>' . h($role === 'admin' ? 'Support' : 'Client') . '</strong><span>' . h((string) $message['created_at']) . '</span></header><p>' . nl2br(h((string) $message['body'])) . '</p></article>';
    }
    $messageRows = $messageRows ?: '<p>Aucun message.</p>';
    $statusOptions = ticket_status_options((string) $ticket['status']);
    $priorityOptions = ticket_priority_options((string) ($ticket['priority'] ?? 'normal'));
    $disabledReply = (string) $ticket['status'] === 'open' ? '' : ' disabled';
    $clientHref = admin_client_modal_url((int) $ticket['user_id'], 'admin-support', 'profile');

    return render_admin_modal_shell('Ticket #' . (int) $ticket['id'] . ' - ' . (string) $ticket['subject'], admin_redirect_url() . '#admin-support', '
      <section class="modal-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Support</p>
            <h3>' . h((string) $ticket['email']) . '</h3>
          </div>
          <a class="secondary compact-link" href="' . h($clientHref) . '">Ouvrir client</a>
        </div>
        <div class="client-summary compact">
          <div class="stat"><span>Compte</span><strong>' . h((string) $ticket['user_status']) . '</strong></div>
          <div class="stat"><span>Credits</span><strong>' . (int) $ticket['credits'] . '</strong></div>
          <div class="stat"><span>Ticket</span><strong>' . h((string) $ticket['status']) . '</strong></div>
        </div>
      </section>
      <section class="modal-section">
        <h3>Fil de conversation</h3>
        <p>Priorite: ' . h((string) ($ticket['priority'] ?? 'normal')) . ' · Assigne: ' . h((string) ($ticket['assigned_to'] ?: '-')) . '</p>
        <div class="ticket-thread">' . $messageRows . '</div>
      </section>
      <section class="modal-section">
        <div class="ticket-admin-forms">
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="reply_ticket">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>Reponse support</span><textarea name="body" maxlength="5000" rows="4"' . $disabledReply . '></textarea></label>
            <button type="submit"' . $disabledReply . '>Envoyer reponse client</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="set_ticket_status">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>Statut</span><select name="ticket_status">' . $statusOptions . '</select></label>
            <button type="submit">Fermer / reouvrir</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="update_ticket_meta">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>Priorite</span><select name="priority">' . $priorityOptions . '</select></label>
            <label><span>Assigne a</span><input type="text" name="assigned_to" maxlength="120" value="' . h((string) ($ticket['assigned_to'] ?? '')) . '"></label>
            <button type="submit">Mettre a jour</button>
          </form>
        </div>
      </section>
    ');
}

function render_admin_modal(PDO $pdo, ?array $selectedUser): string
{
    $ticketId = (int) ($_GET['ticket_id'] ?? 0);
    if ($ticketId > 0) {
        return render_ticket_modal($pdo, $ticketId);
    }
    if ($selectedUser !== null) {
        $returnTab = admin_tab_value((string) ($_GET['return_tab'] ?? 'admin-clients'));
        $panel = 'client-' . admin_client_panel_value((string) ($_GET['client_panel'] ?? 'profile'));
        $closeUrl = $returnTab === 'admin-billing'
            ? admin_billing_filter_url()
            : (admin_redirect_url() . '#' . $returnTab);
        return render_client_modal($pdo, $selectedUser, $closeUrl, $panel);
    }
    return '';
}

function admin_bool_label(bool $value, string $trueLabel = 'Actif', string $falseLabel = 'Inactif'): string
{
    return $value ? $trueLabel : $falseLabel;
}

function admin_db_driver_label(string $driver): string
{
    return $driver === 'mysql' ? 'MySQL cPanel' : 'SQLite local';
}

function admin_secret_source_label(bool $fromEnv, bool $hasStored, string $kind = 'Secret'): string
{
    if ($fromEnv) {
        return $kind . ' via variable serveur';
    }
    if ($hasStored) {
        return $kind . ' enregistre';
    }
    return $kind . ' absent';
}

function render_email_settings_panel(PDO $pdo): string
{
    $settings = mail_settings($pdo);
    $encryptionOptions = '';
    foreach (SMTP_ENCRYPTIONS as $option) {
        $selected = $settings['encryption'] === $option ? ' selected' : '';
        $encryptionOptions .= '<option value="' . h($option) . '"' . $selected . '>' . h($option) . '</option>';
    }
    $recent = $pdo->query('SELECT id, ticket_id, recipient, subject, status, error, created_at, sent_at FROM ticket_notifications ORDER BY id DESC LIMIT 20')->fetchAll();
    $rows = '';
    foreach ($recent as $row) {
        $rows .= '<tr><td>' . (int) $row['id'] . '</td><td>#' . (int) $row['ticket_id'] . '</td><td>' . h((string) $row['recipient']) . '</td><td>' . h((string) $row['subject']) . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) ($row['error'] ?: '-')) . '</td><td>' . h((string) ($row['sent_at'] ?: $row['created_at'])) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="7">Aucun email ticket.</td></tr>';
    $passwordNote = getenv('NICHOIR_SMTP_PASSWORD') ? 'Mot de passe fourni par variable serveur NICHOIR_SMTP_PASSWORD.' : 'Laisser vide pour conserver le mot de passe actuel.';
    $sentCount = 0;
    $failedCount = 0;
    foreach ($recent as $row) {
        $status = (string) ($row['status'] ?? '');
        if ($status === 'sent') {
            $sentCount++;
        } elseif ($status === 'failed') {
            $failedCount++;
        }
    }

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Email tickets</h2>
            <p>Configure le relais SMTP utilise pour les tickets, puis valide l envoi avant de compter dessus en production.</p>
          </div>
          <div>' . admin_log_badge($settings['enabled'] ? 'success' : 'neutral', admin_bool_label($settings['enabled'], 'SMTP actif', 'SMTP inactif')) . '</div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>Etat</span><strong>' . h(admin_bool_label($settings['enabled'], 'Actif', 'Inactif')) . '</strong></div>
          <div class="stat"><span>Support</span><strong>' . h((string) ($settings['support_email'] ?: '-')) . '</strong></div>
          <div class="stat"><span>Envoyes</span><strong>' . $sentCount . '</strong></div>
          <div class="stat"><span>Echecs</span><strong>' . $failedCount . '</strong></div>
        </div>
        <form class="admin-email-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="update_email_settings">
          <label class="checkbox-label"><input type="checkbox" name="smtp_enabled" value="1"' . ($settings['enabled'] ? ' checked' : '') . '> Activer envoi SMTP</label>
          <label><span>Serveur SMTP</span><input type="text" name="smtp_host" value="' . h((string) $settings['host']) . '" placeholder="mail.domaine.com"></label>
          <label><span>Port</span><input type="number" name="smtp_port" min="1" max="65535" value="' . (int) $settings['port'] . '"></label>
          <label><span>Chiffrement</span><select name="smtp_encryption">' . $encryptionOptions . '</select></label>
          <label><span>Utilisateur SMTP</span><input type="text" name="smtp_username" value="' . h((string) $settings['username']) . '" autocomplete="username"></label>
          <label><span>Mot de passe SMTP</span><input type="password" name="smtp_password" autocomplete="new-password" placeholder="' . h($passwordNote) . '"></label>
          <label><span>Email expediteur</span><input type="email" name="smtp_from_email" value="' . h((string) $settings['from_email']) . '" placeholder="support@domaine.com"></label>
          <label><span>Nom expediteur</span><input type="text" name="smtp_from_name" value="' . h((string) $settings['from_name']) . '" maxlength="120"></label>
          <label><span>Email support</span><input type="email" name="support_email" value="' . h((string) $settings['support_email']) . '" placeholder="support@domaine.com"></label>
          <button type="submit">Enregistrer email</button>
        </form>
        <div class="settings-subsection">
          <div class="section-heading log-section-heading">
            <div>
              <h3>Test d envoi</h3>
              <p>Valide les identifiants SMTP et l expedition reelle avant de fermer la configuration.</p>
            </div>
          </div>
          <form class="admin-email-test" method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="send_test_email">
            <label><span>Email test</span><input type="email" name="test_recipient" value="' . h((string) $settings['support_email']) . '" required></label>
            <button type="submit">Envoyer test</button>
          </form>
        </div>
        <div class="settings-subsection">
          <div class="section-heading log-section-heading">
            <div>
              <h3>Activite recente</h3>
              <p>Historique court des notifications tickets envoye es, ratees ou en attente.</p>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>ID</th><th>Ticket</th><th>Destinataire</th><th>Sujet</th><th>Etat</th><th>Erreur</th><th>Date</th></tr></thead><tbody>' . $rows . '</tbody></table></div>
        </div>
      </section>
    ';
}

function render_stripe_settings_panel(PDO $pdo): string
{
    $settings = stripe_settings($pdo);
    $secretNote = stripe_setting_secret_is_env('NICHOIR_STRIPE_SECRET_KEY') ? 'Cle fournie par NICHOIR_STRIPE_SECRET_KEY.' : 'Laisser vide pour conserver la cle actuelle.';
    $webhookNote = stripe_setting_secret_is_env('NICHOIR_STRIPE_WEBHOOK_SECRET') ? 'Secret fourni par NICHOIR_STRIPE_WEBHOOK_SECRET.' : 'Laisser vide pour conserver le secret actuel.';
    $priceCount = 0;
    foreach (['price_credits', 'price_atelier', 'price_pro'] as $key) {
        if (trim((string) ($settings[$key] ?? '')) !== '') {
            $priceCount++;
        }
    }
    $secretSource = admin_secret_source_label(
        stripe_setting_secret_is_env('NICHOIR_STRIPE_SECRET_KEY'),
        trim((string) ($settings['secret_key'] ?? '')) !== '',
        'Cle'
    );
    $webhookSource = admin_secret_source_label(
        stripe_setting_secret_is_env('NICHOIR_STRIPE_WEBHOOK_SECRET'),
        trim((string) ($settings['webhook_secret'] ?? '')) !== '',
        'Webhook'
    );

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Stripe billing</h2>
            <p>Configure Checkout, portail client et verification webhook. Les secrets doivent idealement venir des variables serveur.</p>
          </div>
          <div>' . admin_log_badge($settings['enabled'] ? 'success' : 'neutral', admin_bool_label($settings['enabled'], 'Stripe actif', 'Stripe inactif')) . '</div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>Etat</span><strong>' . h(admin_bool_label($settings['enabled'], 'Actif', 'Inactif')) . '</strong></div>
          <div class="stat"><span>Devise</span><strong>' . h(strtoupper((string) $settings['currency'])) . '</strong></div>
          <div class="stat"><span>Prices</span><strong>' . $priceCount . '</strong></div>
          <div class="stat"><span>Secrets</span><strong>' . h($webhookSource) . '</strong></div>
        </div>
        <form class="admin-stripe-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="update_stripe_settings">
          <label class="checkbox-label"><input type="checkbox" name="stripe_enabled" value="1"' . ($settings['enabled'] ? ' checked' : '') . '> Activer Stripe reel</label>
          <label><span>Cle secrete Stripe</span><input type="password" name="stripe_secret_key" autocomplete="new-password" placeholder="' . h($secretNote) . '"></label>
          <label><span>Webhook secret</span><input type="password" name="stripe_webhook_secret" autocomplete="new-password" placeholder="' . h($webhookNote) . '"></label>
          <label><span>Devise</span><input type="text" name="stripe_currency" value="' . h((string) $settings['currency']) . '" maxlength="3"></label>
          <label><span>Price credits</span><input type="text" name="stripe_price_credits" value="' . h((string) $settings['price_credits']) . '" placeholder="price_..."></label>
          <label><span>Credits achetes</span><input type="number" name="stripe_credits_quantity" min="1" step="1" value="' . (int) $settings['credits_quantity'] . '"></label>
          <label><span>Price atelier</span><input type="text" name="stripe_price_atelier" value="' . h((string) $settings['price_atelier']) . '" placeholder="price_..."></label>
          <label><span>Price pro</span><input type="text" name="stripe_price_pro" value="' . h((string) $settings['price_pro']) . '" placeholder="price_..."></label>
          <button type="submit">Enregistrer Stripe</button>
        </form>
        <p class="section-hint settings-inline-hint">Source cle: ' . h($secretSource) . ' · Source webhook: ' . h($webhookSource) . '</p>
      </section>
    ';
}

function render_database_settings_panel(): string
{
    $config = db_config();
    $local = db_local_config();
    $env = db_env_config();
    $driver = (string) $config['driver'];
    $source = $env !== [] ? 'Variables serveur NICHOIR_DB_* actives' : (is_file(db_config_path()) ? 'Fichier local data/db-config.php' : 'SQLite local par defaut');
    $sqliteChecked = $driver === 'sqlite' ? ' checked' : '';
    $mysqlChecked = $driver === 'mysql' ? ' checked' : '';
    $passwordNote = db_env_value('NICHOIR_DB_PASSWORD') !== null
        ? 'Mot de passe fourni par NICHOIR_DB_PASSWORD.'
        : (((string) ($local['mysql_password'] ?? '') !== '') ? 'Laisser vide pour conserver le mot de passe enregistre.' : 'Mot de passe utilisateur MySQL cPanel.');
    $sourceLabel = $env !== [] ? 'Variables serveur' : (is_file(db_config_path()) ? 'Config locale' : 'SQLite par defaut');
    $configLabel = is_file(db_config_path()) ? 'data/db-config.php' : 'Aucun fichier local';

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Base de donnees</h2>
            <p>Choisis le driver actif, renseigne la connexion cible, puis teste avant enregistrement. Le schema MySQL est cree si la base est vide.</p>
          </div>
          <div>' . admin_log_badge($driver === 'mysql' ? 'info' : 'neutral', admin_db_driver_label($driver)) . '</div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>Driver actif</span><strong>' . h(admin_db_driver_label($driver)) . '</strong></div>
          <div class="stat"><span>Source</span><strong>' . h($sourceLabel) . '</strong></div>
          <div class="stat"><span>Config locale</span><strong>' . h($configLabel) . '</strong></div>
          <div class="stat"><span>Mode local</span><strong>' . h($driver === 'sqlite' ? 'Oui' : 'Non') . '</strong></div>
        </div>
        <form class="admin-db-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <fieldset class="db-driver-choice">
            <legend>Driver</legend>
            <label class="checkbox-label"><input type="radio" name="db_driver" value="sqlite"' . $sqliteChecked . '> SQLite local</label>
            <label class="checkbox-label"><input type="radio" name="db_driver" value="mysql"' . $mysqlChecked . '> MySQL cPanel</label>
          </fieldset>
          <label><span>Chemin SQLite</span><input type="text" name="sqlite_path" value="' . h((string) $config['sqlite_path']) . '"></label>
          <label><span>Host MySQL</span><input type="text" name="mysql_host" value="' . h((string) $config['mysql_host']) . '" placeholder="localhost"></label>
          <label><span>Port</span><input type="number" name="mysql_port" min="1" max="65535" value="' . h((string) $config['mysql_port']) . '"></label>
          <label><span>Nom base</span><input type="text" name="mysql_database" value="' . h((string) $config['mysql_database']) . '" placeholder="cpaneluser_nichoir"></label>
          <label><span>Utilisateur</span><input type="text" name="mysql_username" value="' . h((string) $config['mysql_username']) . '" autocomplete="username" placeholder="cpaneluser_dbuser"></label>
          <label><span>Mot de passe</span><input type="password" name="mysql_password" autocomplete="new-password" placeholder="' . h($passwordNote) . '"></label>
          <label><span>Charset</span><input type="text" name="mysql_charset" value="' . h((string) $config['mysql_charset']) . '"></label>
          <div class="form-actions span-all">
            <button type="submit" name="action" value="test_database_settings">Tester connexion</button>
            <button type="submit" name="action" value="update_database_settings">Enregistrer DB</button>
          </div>
        </form>
        <p class="section-hint settings-inline-hint">Source active: ' . h($source) . '. En production, preferer `NICHOIR_DB_*` aux secrets stockes localement.</p>
      </section>
    ';
}

function render_admin_settings_panel(PDO $pdo): string
{
    $db = db_config();
    $mail = mail_settings($pdo);
    $stripe = stripe_settings($pdo);
    $cards = '
      <div class="stats-grid billing-summary-grid">
        <div class="stat"><span>DB</span><strong>' . h(admin_db_driver_label((string) $db['driver'])) . '</strong></div>
        <div class="stat"><span>SMTP</span><strong>' . h(admin_bool_label((bool) $mail['enabled'], 'Actif', 'Inactif')) . '</strong></div>
        <div class="stat"><span>Stripe</span><strong>' . h(admin_bool_label((bool) $stripe['enabled'], 'Actif', 'Inactif')) . '</strong></div>
        <div class="stat"><span>Priorite</span><strong>Tester avant prod</strong></div>
      </div>
    ';

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Reglages systeme</h2>
            <p>Infrastructure, email et billing. Chaque bloc se configure separement et doit etre valide avant deploiement.</p>
          </div>
        </div>
        ' . $cards . '
      </section>
      ' . render_database_settings_panel() . '
      ' . render_email_settings_panel($pdo) . '
      ' . render_stripe_settings_panel($pdo) . '
    ';
}

function render_admin_billing_panel(PDO $pdo): string
{
    $filters = admin_billing_filters();
    $scope = (string) $filters['billing_scope'];
    $query = (string) $filters['billing_q'];
    $plan = (string) $filters['billing_plan'];
    $provider = (string) $filters['billing_provider'];
    $subscriptionStatus = (string) $filters['billing_subscription_status'];
    $paymentStatus = (string) $filters['billing_payment_status'];
    $currency = (string) $filters['billing_currency'];
    $invoice = (string) $filters['billing_invoice'];
    $dateFrom = (string) $filters['billing_date_from'];
    $dateTo = (string) $filters['billing_date_to'];
    $amountMin = (string) $filters['billing_amount_min'];
    $amountMax = (string) $filters['billing_amount_max'];

    $subscriptionWhere = [];
    $subscriptionParams = [];
    if ($query !== '') {
        $term = '%' . $query . '%';
        $subscriptionWhere[] = '(users.email LIKE ? OR users.display_name LIKE ? OR subscriptions.plan LIKE ? OR subscriptions.provider LIKE ? OR COALESCE(subscriptions.stripe_customer_id, "") LIKE ? OR COALESCE(subscriptions.stripe_subscription_id, "") LIKE ?)';
        array_push($subscriptionParams, $term, $term, $term, $term, $term, $term);
        if (ctype_digit($query)) {
            $subscriptionWhere[] = 'users.id = ?';
            $subscriptionParams[] = (int) $query;
        }
    }
    if ($plan !== '') {
        $subscriptionWhere[] = 'subscriptions.plan = ?';
        $subscriptionParams[] = $plan;
    }
    if ($provider !== '') {
        $subscriptionWhere[] = 'subscriptions.provider = ?';
        $subscriptionParams[] = $provider;
    }
    if ($subscriptionStatus !== '') {
        $subscriptionWhere[] = 'subscriptions.status = ?';
        $subscriptionParams[] = $subscriptionStatus;
    }
    if ($dateFrom !== '') {
        $subscriptionWhere[] = 'date(COALESCE(subscriptions.updated_at, subscriptions.current_period_end)) >= date(?)';
        $subscriptionParams[] = $dateFrom;
    }
    if ($dateTo !== '') {
        $subscriptionWhere[] = 'date(COALESCE(subscriptions.updated_at, subscriptions.current_period_end)) <= date(?)';
        $subscriptionParams[] = $dateTo;
    }

    $subscriptionSql = 'SELECT subscriptions.id, users.id AS user_id, users.email, plan, subscriptions.status AS subscription_state, provider, current_period_end, subscriptions.updated_at
        FROM subscriptions
        JOIN users ON users.id = subscriptions.user_id';
    if ($subscriptionWhere) {
        $subscriptionSql .= ' WHERE ' . implode(' AND ', $subscriptionWhere);
    }
    $subscriptionSql .= ' ORDER BY subscriptions.updated_at DESC, subscriptions.id DESC LIMIT 100';
    $subscriptionStmt = $pdo->prepare($subscriptionSql);
    $subscriptionStmt->execute($subscriptionParams);
    $subscriptions = $subscriptionStmt->fetchAll();

    $paymentWhere = [];
    $paymentParams = [];
    if ($query !== '') {
        $term = '%' . $query . '%';
        $paymentWhere[] = '(users.email LIKE ? OR users.display_name LIKE ? OR COALESCE(payments.description, "") LIKE ? OR COALESCE(payments.stripe_invoice_id, "") LIKE ? OR COALESCE(payments.stripe_payment_intent_id, "") LIKE ?)';
        array_push($paymentParams, $term, $term, $term, $term, $term);
        if (ctype_digit($query)) {
            $paymentWhere[] = 'users.id = ?';
            $paymentParams[] = (int) $query;
        }
    }
    if ($paymentStatus !== '') {
        $paymentWhere[] = 'payments.status = ?';
        $paymentParams[] = $paymentStatus;
    }
    if ($currency !== '') {
        $paymentWhere[] = 'LOWER(payments.currency) = ?';
        $paymentParams[] = $currency;
    }
    if ($invoice === 'yes') {
        $paymentWhere[] = '(COALESCE(payments.invoice_url, "") <> "" OR COALESCE(payments.invoice_pdf, "") <> "")';
    } elseif ($invoice === 'no') {
        $paymentWhere[] = '(COALESCE(payments.invoice_url, "") = "" AND COALESCE(payments.invoice_pdf, "") = "")';
    }
    if ($dateFrom !== '') {
        $paymentWhere[] = 'date(payments.created_at) >= date(?)';
        $paymentParams[] = $dateFrom;
    }
    if ($dateTo !== '') {
        $paymentWhere[] = 'date(payments.created_at) <= date(?)';
        $paymentParams[] = $dateTo;
    }
    if ($amountMin !== '') {
        $paymentWhere[] = 'payments.amount_cents >= ?';
        $paymentParams[] = (int) round(((float) $amountMin) * 100);
    }
    if ($amountMax !== '') {
        $paymentWhere[] = 'payments.amount_cents <= ?';
        $paymentParams[] = (int) round(((float) $amountMax) * 100);
    }

    $paymentSql = 'SELECT payments.id, users.id AS user_id, users.email, amount_cents, currency, payments.status AS payment_state, description, invoice_url, invoice_pdf, payments.created_at
        FROM payments
        JOIN users ON users.id = payments.user_id';
    if ($paymentWhere) {
        $paymentSql .= ' WHERE ' . implode(' AND ', $paymentWhere);
    }
    $paymentSql .= ' ORDER BY payments.created_at DESC, payments.id DESC LIMIT 100';
    $paymentStmt = $pdo->prepare($paymentSql);
    $paymentStmt->execute($paymentParams);
    $payments = $paymentStmt->fetchAll();
    $providerCount = count(array_unique(array_values(array_filter(array_map(static fn (array $subscription): string => trim((string) ($subscription['provider'] ?? '')), $subscriptions)))));

    $planOptions = $pdo->query('SELECT DISTINCT plan FROM subscriptions WHERE plan IS NOT NULL AND plan <> "" ORDER BY plan ASC')->fetchAll(PDO::FETCH_COLUMN);
    $providerOptions = $pdo->query('SELECT provider FROM subscriptions WHERE provider IS NOT NULL AND provider <> "" UNION SELECT provider FROM payments WHERE provider IS NOT NULL AND provider <> "" ORDER BY provider ASC')->fetchAll(PDO::FETCH_COLUMN);
    $subscriptionStatusOptions = $pdo->query('SELECT DISTINCT status FROM subscriptions WHERE status IS NOT NULL AND status <> "" ORDER BY status ASC')->fetchAll(PDO::FETCH_COLUMN);
    $paymentStatusOptions = $pdo->query('SELECT DISTINCT status FROM payments WHERE status IS NOT NULL AND status <> "" ORDER BY status ASC')->fetchAll(PDO::FETCH_COLUMN);
    $currencyOptions = $pdo->query('SELECT DISTINCT LOWER(currency) FROM payments WHERE currency IS NOT NULL AND currency <> "" ORDER BY LOWER(currency) ASC')->fetchAll(PDO::FETCH_COLUMN);
    $subscriptionStatusMap = [];
    foreach ($subscriptionStatusOptions as $value) {
        $subscriptionStatusMap[(string) $value] = admin_subscription_status_label((string) $value);
    }
    $paymentStatusMap = [];
    foreach ($paymentStatusOptions as $value) {
        $paymentStatusMap[(string) $value] = admin_payment_status_label((string) $value);
    }
    $providerMap = [];
    foreach ($providerOptions as $value) {
        $providerMap[(string) $value] = admin_provider_label((string) $value);
    }
    $currencyMap = [];
    foreach ($currencyOptions as $value) {
        $currencyMap[(string) $value] = strtoupper((string) $value);
    }

    $subscriptionRows = '';
    $activeSubscriptionCount = 0;
    $upcomingSubscriptionCount = 0;
    foreach ($subscriptions as $subscription) {
        $clientHref = admin_client_modal_url((int) $subscription['user_id'], 'admin-billing', 'billing', $filters);
        $subscriptionState = (string) $subscription['subscription_state'];
        $statusTone = match ($subscriptionState) {
            'active', 'trialing' => 'success',
            'past_due', 'incomplete' => 'warning',
            'canceled', 'cancelled', 'unpaid' => 'danger',
            default => 'neutral',
        };
        if (in_array($subscriptionState, ['active', 'trialing'], true)) {
            $activeSubscriptionCount++;
        }
        if ((string) ($subscription['current_period_end'] ?? '') !== '') {
            $upcomingSubscriptionCount++;
        }
        $subscriptionRows .= '<tr><td>' . (int) $subscription['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $subscription['email']) . '</a></td><td><strong>' . h((string) $subscription['plan']) . '</strong></td><td>' . admin_log_badge($statusTone, admin_subscription_status_label($subscriptionState)) . '</td><td><code>' . h(admin_provider_label((string) ($subscription['provider'] ?: ''))) . '</code></td><td>' . h((string) ($subscription['current_period_end'] ?: '-')) . '</td><td>' . h((string) ($subscription['updated_at'] ?: '-')) . '</td></tr>';
    }
    if ($subscriptionRows === '') {
        $subscriptionRows = '<tr><td colspan="7">Aucun abonnement pour ces filtres.</td></tr>';
    }

    $paymentRows = '';
    $paymentCurrencies = [];
    $paymentInvoiceCount = 0;
    $paidPaymentCount = 0;
    foreach ($payments as $payment) {
        $clientHref = admin_client_modal_url((int) $payment['user_id'], 'admin-billing', 'billing', $filters);
        $invoiceLinks = ((string) $payment['invoice_url'] !== '' ? '<a href="' . h((string) $payment['invoice_url']) . '" target="_blank" rel="noreferrer">Voir</a> ' : '')
            . ((string) $payment['invoice_pdf'] !== '' ? '<a href="' . h((string) $payment['invoice_pdf']) . '" target="_blank" rel="noreferrer">PDF</a>' : '');
        if ($invoiceLinks !== '') {
            $paymentInvoiceCount++;
        }
        $paymentState = (string) $payment['payment_state'];
        $statusTone = match ($paymentState) {
            'paid', 'succeeded' => 'success',
            'pending', 'processing', 'requires_action' => 'warning',
            'failed', 'canceled', 'cancelled' => 'danger',
            default => 'neutral',
        };
        if (in_array($paymentState, ['paid', 'succeeded'], true)) {
            $paidPaymentCount++;
        }
        $paymentRows .= '<tr><td>' . (int) $payment['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $payment['email']) . '</a></td><td><strong>' . h(money_cents((int) $payment['amount_cents'], (string) $payment['currency'])) . '</strong></td><td>' . admin_log_badge($statusTone, admin_payment_status_label($paymentState)) . '</td><td>' . h(admin_log_text((string) ($payment['description'] ?: '-'), 80)) . '</td><td>' . ($invoiceLinks ?: '-') . '</td><td>' . h((string) $payment['created_at']) . '</td></tr>';
        $currencyKey = strtoupper((string) ($payment['currency'] ?: ''));
        if (!isset($paymentCurrencies[$currencyKey])) {
            $paymentCurrencies[$currencyKey] = 0;
        }
        $paymentCurrencies[$currencyKey] += (int) $payment['amount_cents'];
    }
    if ($paymentRows === '') {
        $paymentRows = '<tr><td colspan="7">Aucun paiement pour ces filtres.</td></tr>';
    }

    $currencySummary = '-';
    if ($paymentCurrencies !== []) {
        $parts = [];
        foreach ($paymentCurrencies as $currencyCode => $value) {
            $parts[] = money_cents($value, $currencyCode === '' ? 'cad' : $currencyCode);
        }
        $currencySummary = implode(' / ', $parts);
    }
    $invoiceHtml = '<option value="">Toutes</option>'
        . '<option value="yes"' . ($invoice === 'yes' ? ' selected' : '') . '>Avec facture</option>'
        . '<option value="no"' . ($invoice === 'no' ? ' selected' : '') . '>Sans facture</option>';
    $advancedFiltersOpen = $plan !== '' || $provider !== '' || $currency !== '' || $invoice !== '' || $amountMin !== '' || $amountMax !== '';
    $summaryCards = match ($scope) {
        'subscriptions' => '
          <div class="stat"><span>Abonnements</span><strong>' . count($subscriptions) . '</strong></div>
          <div class="stat"><span>Actifs</span><strong>' . $activeSubscriptionCount . '</strong></div>
          <div class="stat"><span>Echeances</span><strong>' . $upcomingSubscriptionCount . '</strong></div>
          <div class="stat"><span>Providers</span><strong>' . $providerCount . '</strong></div>
        ',
        'payments' => '
          <div class="stat"><span>Paiements</span><strong>' . count($payments) . '</strong></div>
          <div class="stat"><span>Payes</span><strong>' . $paidPaymentCount . '</strong></div>
          <div class="stat"><span>Factures</span><strong>' . $paymentInvoiceCount . '</strong></div>
          <div class="stat"><span>Total filtre</span><strong>' . h($currencySummary) . '</strong></div>
        ',
        default => '
          <div class="stat"><span>Abonnements</span><strong>' . count($subscriptions) . '</strong></div>
          <div class="stat"><span>Paiements</span><strong>' . count($payments) . '</strong></div>
          <div class="stat"><span>Factures</span><strong>' . $paymentInvoiceCount . '</strong></div>
          <div class="stat"><span>Total filtre</span><strong>' . h($currencySummary) . '</strong></div>
        ',
    };

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Billing</h2>
            <p>Vue revenus et abonnements. Garde d abord la portee, la recherche et la periode, puis affine si besoin.</p>
          </div>
          <div class="form-actions">
            <a class="secondary compact-link" href="' . h(admin_redirect_url()) . '#admin-billing">Reinitialiser</a>
          </div>
        </div>
        <div class="stats-grid billing-summary-grid">
          ' . $summaryCards . '
        </div>
        ' . admin_billing_scope_nav($filters, count($subscriptions), count($payments)) . '
        <form class="log-filter-stack" method="get" action="/admin#admin-billing">
          ' . admin_key_input() . '
          <input type="hidden" name="billing_scope" value="' . h($scope) . '">
          <div class="admin-directory-form admin-billing-filters">
            <label class="span-2"><span>Client / recherche</span><input type="search" name="billing_q" value="' . h($query) . '" placeholder="email, id, description"></label>
            ' . ($scope !== 'payments' ? '<label><span>Etat abonnement</span><select name="billing_subscription_status">' . admin_select_options($subscriptionStatusMap, $subscriptionStatus, 'Tous') . '</select></label>' : '') . '
            ' . ($scope !== 'subscriptions' ? '<label><span>Etat paiement</span><select name="billing_payment_status">' . admin_select_options($paymentStatusMap, $paymentStatus, 'Tous') . '</select></label>' : '') . '
            <label><span>Date debut</span><input type="date" name="billing_date_from" value="' . h($dateFrom) . '"></label>
            <label><span>Date fin</span><input type="date" name="billing_date_to" value="' . h($dateTo) . '"></label>
            <button type="submit">Appliquer</button>
          </div>
          <details class="log-filter-details"' . ($advancedFiltersOpen ? ' open' : '') . '>
            <summary>Filtres avances billing</summary>
            <div class="admin-directory-form admin-billing-filters advanced">
              ' . ($scope !== 'payments' ? '<label><span>Plan</span><select name="billing_plan">' . admin_select_options($planOptions, $plan, 'Tous') . '</select></label>' : '') . '
              <label><span>Provider</span><select name="billing_provider">' . admin_select_options($providerMap, $provider, 'Tous') . '</select></label>
              ' . ($scope !== 'subscriptions' ? '<label><span>Devise</span><select name="billing_currency">' . admin_select_options($currencyMap, $currency, 'Toutes') . '</select></label>' : '') . '
              ' . ($scope !== 'subscriptions' ? '<label><span>Facture</span><select name="billing_invoice">' . $invoiceHtml . '</select></label>' : '') . '
              ' . ($scope !== 'subscriptions' ? '<label><span>Montant min</span><input type="number" name="billing_amount_min" min="0" step="0.01" value="' . h($amountMin) . '" placeholder="0.00"></label>' : '') . '
              ' . ($scope !== 'subscriptions' ? '<label><span>Montant max</span><input type="number" name="billing_amount_max" min="0" step="0.01" value="' . h($amountMax) . '" placeholder="499.00"></label>' : '') . '
            </div>
          </details>
          ' . admin_billing_filter_summary($filters) . '
        </form>
      </section>
      ' . ($scope !== 'payments' ? '
      <section class="panel">
        <div class="section-heading log-section-heading"><div><h2>Abonnements filtres</h2><p>Etat courant du plan, provider et prochaine echeance.</p></div><div>' . admin_log_badge('neutral', (string) count($subscriptions)) . '</div></div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Plan</th><th>Etat</th><th>Provider</th><th>Fin periode</th><th>MAJ</th></tr></thead><tbody>' . $subscriptionRows . '</tbody></table></div>
      </section>
      ' : '') . '
      ' . ($scope !== 'subscriptions' ? '
      <section class="panel">
        <div class="section-heading log-section-heading"><div><h2>Paiements filtres</h2><p>Montants encaisses, statut de traitement et presence de facture.</p></div><div>' . admin_log_badge('neutral', (string) count($payments)) . '</div></div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Montant</th><th>Etat</th><th>Description</th><th>Facture</th><th>Date</th></tr></thead><tbody>' . $paymentRows . '</tbody></table></div>
      </section>
      ' : '');
}

function render_admin_export_links(string $scope): string
{
    return '
      <div class="form-actions export-download-actions">
        <a class="secondary compact-link" href="' . h(admin_exports_download_url('csv', $scope)) . '">CSV</a>
        <a class="secondary compact-link" href="' . h(admin_exports_download_url('xls', $scope)) . '">Excel</a>
        <a class="secondary compact-link" href="' . h(admin_exports_download_url('json', $scope)) . '">JSON</a>
      </div>
    ';
}

function admin_export_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'authorized' => 'Autorise',
        'consumed' => 'Consomme',
        'revoked' => 'Revoque',
        'expired' => 'Expire',
        default => admin_code_label($status),
    };
}

function admin_export_status_tone(string $status): string
{
    return match (strtolower(trim($status))) {
        'authorized' => 'warning',
        'consumed' => 'success',
        'revoked', 'expired' => 'neutral',
        default => 'neutral',
    };
}

function render_admin_database_export_panel(): string
{
    $scopes = [
        'all' => ['Base complete', 'Timeline CSV triee par date; Excel/JSON avec tables separees par domaine. Secrets et tokens ne sont pas exportes.'],
        'clients' => ['Clients', 'Comptes, credits courants, statut et abonnement courant.'],
        'billing' => ['Billing', 'Abonnements, paiements, factures et identifiants Stripe utiles.'],
        'support' => ['Support', 'Tickets, messages et notifications email.'],
        'credits' => ['Credits', 'Historique des mouvements de credits par client.'],
        'exports' => ['Autorisations', 'Demandes d exports, couts, et consommation.'],
    ];

    $cards = '';
    foreach ($scopes as $scope => [$label, $description]) {
        $cards .= '
          <article class="export-scope-card">
            <div class="export-scope-copy">
              <h3>' . h($label) . '</h3>
              <p>' . h($description) . '</p>
            </div>
            ' . render_admin_export_links((string) $scope) . '
          </article>
        ';
    }

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Exports base de donnees</h2>
            <p>Choisis une portee metier puis un format. Les exports servent a sortir la base de travail, pas l historique detaille d usage.</p>
          </div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>Portees</span><strong>' . count($scopes) . '</strong></div>
          <div class="stat"><span>Formats</span><strong>CSV / XLS / JSON</strong></div>
          <div class="stat"><span>Usage</span><strong>Base metier</strong></div>
          <div class="stat"><span>Securite</span><strong>Secrets exclus</strong></div>
        </div>
        <div class="export-scope-grid">' . $cards . '</div>
      </section>
    ';
}

function admin_log_text(string $value, int $limit = 220): string
{
    $value = trim($value);
    return strlen($value) > $limit ? substr($value, 0, $limit) . '...' : $value;
}

function admin_log_badge(string $tone, string $label): string
{
    return '<span class="status-badge tone-' . h($tone) . '">' . h($label) . '</span>';
}

function admin_log_scope_label(string $scope): string
{
    return match ($scope) {
        'application' => 'Application',
        'audit' => 'Audit',
        'stripe' => 'Stripe',
        default => 'Toutes les sources',
    };
}

function admin_log_scope_nav(array $filters, array $counts): string
{
    $current = (string) ($filters['log_scope'] ?? 'all');
    $items = [
        'all' => ['Toutes', (int) (($counts['application'] ?? 0) + ($counts['audit'] ?? 0) + ($counts['stripe'] ?? 0))],
        'application' => ['Application', (int) ($counts['application'] ?? 0)],
        'audit' => ['Audit', (int) ($counts['audit'] ?? 0)],
        'stripe' => ['Stripe', (int) ($counts['stripe'] ?? 0)],
    ];
    $links = '';
    foreach ($items as $scope => [$label, $count]) {
        $class = 'log-scope-link' . ($current === $scope ? ' active' : '');
        $links .= '<a class="' . $class . '" href="' . h(admin_log_filter_link(['log_scope' => $scope])) . '"><span>' . h($label) . '</span><strong>' . $count . '</strong></a>';
    }
    return '<nav class="log-scope-nav" aria-label="Sources de logs">' . $links . '</nav>';
}

function admin_log_filter_summary(array $filters): string
{
    $chips = [];
    $map = [
        'log_level' => 'Niveau',
        'log_channel' => 'Channel',
        'log_event' => 'Event',
        'log_q' => 'Recherche',
        'log_date_from' => 'Depuis',
        'log_date_to' => 'Jusqu a',
        'log_user_id' => 'User',
        'log_http_status' => 'HTTP',
        'log_request_id' => 'Request',
        'log_actor_role' => 'Role',
        'log_action' => 'Action',
        'log_target_type' => 'Cible',
        'log_outcome' => 'Issue',
        'log_stripe_status' => 'Stripe',
        'log_stripe_type' => 'Type Stripe',
    ];
    foreach ($map as $key => $label) {
        $value = trim((string) ($filters[$key] ?? ''));
        if ($value !== '') {
            $chips[] = '<li class="filter-chip"><span>' . h($label) . '</span><strong>' . h($value) . '</strong></li>';
        }
    }
    if (!$chips) {
        return '<p class="section-hint">Aucun filtre avance actif. La vue montre les evenements les plus recents selon la source selectionnee.</p>';
    }
    return '<ul class="filter-chip-list" aria-label="Filtres actifs">' . implode('', $chips) . '</ul>';
}

function admin_log_filter_link(array $params = []): string
{
    $base = admin_log_filters();
    foreach ($base as $key => $value) {
        if ($value === '' || $value === null) {
            unset($base[$key]);
        }
    }
    $key = trim((string) ($_GET['key'] ?? ''));
    if ($key !== '') {
        $base['key'] = $key;
    }
    $merged = array_merge($base, $params);
    foreach ($merged as $key => $value) {
        if ($value === '' || $value === null) {
            unset($merged[$key]);
        }
    }
    return '/admin' . ($merged ? '?' . http_build_query($merged) : '') . '#admin-logs';
}

function admin_logs_download_url(string $format): string
{
    $params = admin_log_filters();
    $params['format'] = admin_export_format_value($format);
    $key = trim((string) ($_GET['key'] ?? ($_POST['key'] ?? '')));
    if ($key !== '') {
        $params['key'] = $key;
    }
    foreach ($params as $name => $value) {
        if ($value === '' || $value === null) {
            unset($params[$name]);
        }
    }
    return '/admin/logs/download?' . http_build_query($params);
}

function admin_log_export_links(): string
{
    return '
      <div class="form-actions export-download-actions">
        <a class="secondary compact-link" href="' . h(admin_logs_download_url('csv')) . '">CSV</a>
        <a class="secondary compact-link" href="' . h(admin_logs_download_url('xls')) . '">Excel</a>
        <a class="secondary compact-link" href="' . h(admin_logs_download_url('json')) . '">JSON</a>
        <a class="secondary compact-link" href="' . h(admin_logs_download_url('sql')) . '">SQL</a>
      </div>
    ';
}

function admin_log_datasets(PDO $pdo, ?array $filters = null): array
{
    $filters = $filters ?? admin_log_filters();
    $level = (string) $filters['log_level'];
    $channel = (string) $filters['log_channel'];
    $event = (string) $filters['log_event'];
    $query = (string) $filters['log_q'];
    $dateFrom = (string) $filters['log_date_from'];
    $dateTo = (string) $filters['log_date_to'];
    $userId = (string) $filters['log_user_id'];
    $httpStatus = (string) $filters['log_http_status'];
    $requestId = (string) $filters['log_request_id'];
    $actorRole = (string) $filters['log_actor_role'];
    $action = (string) $filters['log_action'];
    $targetType = (string) $filters['log_target_type'];
    $outcome = (string) $filters['log_outcome'];
    $stripeStatus = (string) $filters['log_stripe_status'];
    $stripeType = (string) $filters['log_stripe_type'];
    $limit = (int) $filters['log_limit'];

    $appWhere = [];
    $appParams = [];
    if ($level !== '' && in_array($level, LOG_LEVELS, true)) {
        $appWhere[] = 'level = ?';
        $appParams[] = $level;
    }
    if ($channel !== '') {
        $appWhere[] = 'channel = ?';
        $appParams[] = $channel;
    }
    if ($event !== '') {
        $appWhere[] = 'event_code LIKE ?';
        $appParams[] = '%' . $event . '%';
    }
    if ($query !== '') {
        $term = '%' . $query . '%';
        $appWhere[] = '(message LIKE ? OR context_json LIKE ? OR request_id LIKE ? OR route LIKE ?)';
        array_push($appParams, $term, $term, $term, $term);
    }
    if ($dateFrom !== '') {
        $appWhere[] = 'date(created_at) >= date(?)';
        $appParams[] = $dateFrom;
    }
    if ($dateTo !== '') {
        $appWhere[] = 'date(created_at) <= date(?)';
        $appParams[] = $dateTo;
    }
    if ($userId !== '') {
        $appWhere[] = 'user_id = ?';
        $appParams[] = (int) $userId;
    }
    if ($httpStatus !== '') {
        $appWhere[] = 'http_status = ?';
        $appParams[] = (int) $httpStatus;
    }
    if ($requestId !== '') {
        $appWhere[] = 'request_id LIKE ?';
        $appParams[] = '%' . $requestId . '%';
    }
    $appSql = 'SELECT id, created_at, level, channel, event_code, message, user_id, request_id, route, http_method, http_status, context_json FROM app_logs';
    if ($appWhere) {
        $appSql .= ' WHERE ' . implode(' AND ', $appWhere);
    }
    $appSql .= ' ORDER BY id DESC LIMIT ' . $limit;
    $appStmt = $pdo->prepare($appSql);
    $appStmt->execute($appParams);
    $appRows = $appStmt->fetchAll();

    $securityWhere = $appWhere;
    $securityParams = $appParams;
    $securityWhere[] = "(
        level = 'critical'
        OR event_code IN ('rate_limit_triggered', 'admin_access_denied', 'stripe_webhook_signature_failed', 'email_failed', 'php_error', 'login_failed', 'permission_denied', 'csrf_failed', 'invalid_token')
        OR (level = 'security' AND event_code NOT LIKE '%success%' AND event_code NOT LIKE '%verified%' AND event_code NOT LIKE '%_sent')
    )";
    $securitySql = 'SELECT id, created_at, level, channel, event_code, message, user_id, request_id, route, http_method, http_status, context_json FROM app_logs WHERE ' . implode(' AND ', $securityWhere) . ' ORDER BY id DESC LIMIT ' . min($limit, 120);
    $securityStmt = $pdo->prepare($securitySql);
    $securityStmt->execute($securityParams);
    $securityRows = $securityStmt->fetchAll();

    $auditWhere = [];
    $auditParams = [];
    if ($query !== '') {
        $term = '%' . $query . '%';
        $auditWhere[] = '(action LIKE ? OR target_id LIKE ? OR metadata_json LIKE ? OR reason LIKE ?)';
        array_push($auditParams, $term, $term, $term, $term);
    }
    if ($dateFrom !== '') {
        $auditWhere[] = 'date(created_at) >= date(?)';
        $auditParams[] = $dateFrom;
    }
    if ($dateTo !== '') {
        $auditWhere[] = 'date(created_at) <= date(?)';
        $auditParams[] = $dateTo;
    }
    if ($userId !== '') {
        $auditWhere[] = 'actor_user_id = ?';
        $auditParams[] = (int) $userId;
    }
    if ($requestId !== '') {
        $auditWhere[] = 'request_id LIKE ?';
        $auditParams[] = '%' . $requestId . '%';
    }
    if ($actorRole !== '') {
        $auditWhere[] = 'actor_role = ?';
        $auditParams[] = $actorRole;
    }
    if ($action !== '') {
        $auditWhere[] = 'action LIKE ?';
        $auditParams[] = '%' . $action . '%';
    }
    if ($targetType !== '') {
        $auditWhere[] = 'target_type = ?';
        $auditParams[] = $targetType;
    }
    if ($outcome !== '') {
        $auditWhere[] = 'outcome = ?';
        $auditParams[] = $outcome;
    }
    $auditSql = 'SELECT id, created_at, actor_user_id, actor_role, action, target_type, target_id, outcome, reason, request_id, metadata_json FROM audit_logs';
    if ($auditWhere) {
        $auditSql .= ' WHERE ' . implode(' AND ', $auditWhere);
    }
    $auditSql .= ' ORDER BY id DESC LIMIT ' . $limit;
    $auditStmt = $pdo->prepare($auditSql);
    $auditStmt->execute($auditParams);
    $auditRows = $auditStmt->fetchAll();

    $stripeWhere = [];
    $stripeParams = [];
    if ($query !== '') {
        $term = '%' . $query . '%';
        $stripeWhere[] = '(stripe_event_id LIKE ? OR event_type LIKE ? OR stripe_object_id LIKE ? OR error_message LIKE ?)';
        array_push($stripeParams, $term, $term, $term, $term);
    }
    if ($dateFrom !== '') {
        $stripeWhere[] = 'date(created_at) >= date(?)';
        $stripeParams[] = $dateFrom;
    }
    if ($dateTo !== '') {
        $stripeWhere[] = 'date(created_at) <= date(?)';
        $stripeParams[] = $dateTo;
    }
    if ($stripeStatus !== '') {
        $stripeWhere[] = 'status = ?';
        $stripeParams[] = $stripeStatus;
    }
    if ($stripeType !== '') {
        $stripeWhere[] = 'event_type LIKE ?';
        $stripeParams[] = '%' . $stripeType . '%';
    }
    $stripeSql = 'SELECT id, created_at, stripe_event_id, event_type, stripe_object_id, status, attempt_count, error_message, payload_hash FROM stripe_event_logs';
    if ($stripeWhere) {
        $stripeSql .= ' WHERE ' . implode(' AND ', $stripeWhere);
    }
    $stripeSql .= ' ORDER BY id DESC LIMIT ' . $limit;
    $stripeStmt = $pdo->prepare($stripeSql);
    $stripeStmt->execute($stripeParams);
    $stripeRows = $stripeStmt->fetchAll();

    return [
        'scope' => (string) $filters['log_scope'],
        'filters' => $filters,
        'app_rows' => $appRows,
        'security_rows' => $securityRows,
        'audit_rows' => $auditRows,
        'stripe_rows' => $stripeRows,
        'datasets' => [
            'application' => admin_export_dataset('Application logs', ['id', 'created_at', 'level', 'channel', 'event_code', 'message', 'user_id', 'request_id', 'route', 'http_method', 'http_status', 'context_json'], $appRows),
            'audit' => admin_export_dataset('Audit logs', ['id', 'created_at', 'actor_user_id', 'actor_role', 'action', 'target_type', 'target_id', 'outcome', 'reason', 'request_id', 'metadata_json'], $auditRows),
            'stripe' => admin_export_dataset('Stripe event logs', ['id', 'created_at', 'stripe_event_id', 'event_type', 'stripe_object_id', 'status', 'attempt_count', 'error_message', 'payload_hash'], $stripeRows),
        ],
    ];
}

function admin_log_selected_export(array $logData): array
{
    $scope = (string) ($logData['scope'] ?? 'all');
    $datasets = (array) ($logData['datasets'] ?? []);
    if ($scope === 'all') {
        return [
            'label' => 'Logs admin',
            'filename' => 'admin-logs',
            'datasets' => $datasets,
        ];
    }
    return [
        'label' => (string) $datasets[$scope]['label'],
        'filename' => 'admin-logs-' . $scope,
        'datasets' => [$scope => $datasets[$scope]],
    ];
}

function admin_log_timeline_rows(array $datasets): array
{
    $timeline = [];
    foreach ($datasets as $scope => $dataset) {
        foreach ($dataset['rows'] as $row) {
            $timeline[] = [
                'section' => (string) $dataset['label'],
                'date' => (string) ($row['created_at'] ?? ''),
                'record_id' => (string) ($row['id'] ?? ''),
                'user_id' => (string) (($row['user_id'] ?? $row['actor_user_id']) ?? ''),
                'type' => (string) (($row['event_code'] ?? $row['action'] ?? $row['event_type']) ?? $scope),
                'status' => (string) (($row['level'] ?? $row['outcome'] ?? $row['status']) ?? ''),
                'description' => (string) (($row['message'] ?? $row['reason'] ?? $row['error_message']) ?? ''),
                'metadata_json' => json_encode($row, JSON_UNESCAPED_SLASHES),
            ];
        }
    }
    usort($timeline, static fn (array $a, array $b): int => strcmp((string) $b['date'], (string) $a['date']));
    return $timeline;
}

function admin_sql_literal(mixed $value): string
{
    if ($value === null) {
        return 'NULL';
    }
    if (is_bool($value)) {
        return $value ? '1' : '0';
    }
    if (is_int($value) || is_float($value)) {
        return (string) $value;
    }
    return "'" . str_replace("'", "''", (string) $value) . "'";
}

function admin_log_export_send_csv(array $export): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $export['filename'] . '.csv"');
    $out = fopen('php://output', 'w');
    if ($out === false) {
        http_response_code(500);
        echo 'Unable to open output stream';
        return;
    }
    if (count($export['datasets']) > 1) {
        $columns = ['section', 'date', 'record_id', 'user_id', 'type', 'status', 'description', 'metadata_json'];
        fputcsv($out, $columns);
        foreach (admin_log_timeline_rows($export['datasets']) as $row) {
            fputcsv($out, array_map(static fn (string $column): string => (string) ($row[$column] ?? ''), $columns));
        }
    } else {
        $dataset = reset($export['datasets']);
        fputcsv($out, $dataset['columns']);
        foreach ($dataset['rows'] as $row) {
            fputcsv($out, array_map(static fn (string $column): string => admin_export_value($row, $column), $dataset['columns']));
        }
    }
    fclose($out);
}

function admin_log_export_send_json(array $export): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $export['filename'] . '.json"');
    $payload = [
        'label' => $export['label'],
        'generated_at' => (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
        'datasets' => [],
    ];
    foreach ($export['datasets'] as $key => $dataset) {
        $payload['datasets'][$key] = [
            'label' => $dataset['label'],
            'rows' => $dataset['rows'],
        ];
    }
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}

function admin_log_export_send_excel(array $export): void
{
    header('Content-Type: application/vnd.ms-excel; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $export['filename'] . '.xls"');
    echo '<!doctype html><html><head><meta charset="utf-8"></head><body>';
    echo '<h1>' . h((string) $export['label']) . '</h1>';
    echo '<p>Genere le ' . h((new DateTimeImmutable())->format('Y-m-d H:i:s')) . '</p>';
    foreach ($export['datasets'] as $dataset) {
        echo '<h2>' . h((string) $dataset['label']) . '</h2>';
        echo '<table border="1"><thead><tr>';
        foreach ($dataset['columns'] as $column) {
            echo '<th>' . h((string) $column) . '</th>';
        }
        echo '</tr></thead><tbody>';
        foreach ($dataset['rows'] as $row) {
            echo '<tr>';
            foreach ($dataset['columns'] as $column) {
                echo '<td>' . h(admin_export_value($row, (string) $column)) . '</td>';
            }
            echo '</tr>';
        }
        echo '</tbody></table>';
    }
    echo '</body></html>';
}

function admin_log_export_send_sql(array $export): void
{
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $export['filename'] . '.sql"');
    echo "-- Nichoir admin logs export\n";
    echo '-- Generated at ' . (new DateTimeImmutable())->format(DateTimeInterface::ATOM) . "\n\n";
    $tableMap = [
        'application' => 'app_logs',
        'audit' => 'audit_logs',
        'stripe' => 'stripe_event_logs',
    ];
    foreach ($export['datasets'] as $scope => $dataset) {
        $table = $tableMap[$scope] ?? $scope;
        echo "-- " . $dataset['label'] . "\n";
        foreach ($dataset['rows'] as $row) {
            $columns = $dataset['columns'];
            $values = [];
            foreach ($columns as $column) {
                $values[] = admin_sql_literal($row[$column] ?? null);
            }
            echo 'INSERT INTO ' . $table . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ");\n";
        }
        echo "\n";
    }
}

function handle_admin_logs_download(): void
{
    if (!admin_allowed()) {
        http_response_code(403);
        echo 'Forbidden';
        return;
    }

    $format = admin_export_format_value((string) ($_GET['format'] ?? 'csv'));
    if (!in_array($format, ['csv', 'json', 'xls', 'sql'], true)) {
        http_response_code(400);
        echo 'Invalid export format';
        return;
    }

    $export = admin_log_selected_export(admin_log_datasets(db()));
    if ($format === 'json') {
        admin_log_export_send_json($export);
        return;
    }
    if ($format === 'xls') {
        admin_log_export_send_excel($export);
        return;
    }
    if ($format === 'sql') {
        admin_log_export_send_sql($export);
        return;
    }
    admin_log_export_send_csv($export);
}

function render_app_log_rows(array $logs): string
{
    $rows = '';
    foreach ($logs as $log) {
        $level = (string) $log['level'];
        $tone = match ($level) {
            'critical' => 'critical',
            'error' => 'danger',
            'security' => 'warning',
            'warning' => 'warning',
            'info' => 'info',
            default => 'neutral',
        };
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td>' . admin_log_badge($tone, $level) . '</td><td><code>' . h((string) $log['channel']) . '</code></td><td><strong>' . h((string) $log['event_code']) . '</strong></td><td>' . h(admin_log_text((string) $log['message'])) . '</td><td>' . h((string) ($log['user_id'] ?? '')) . '</td><td>' . h((string) ($log['http_status'] ?? '')) . '</td><td><code>' . h(admin_log_text((string) ($log['request_id'] ?? ''), 48)) . '</code></td><td><code>' . h(admin_log_text((string) ($log['context_json'] ?? ''), 160)) . '</code></td></tr>';
    }
    return $rows ?: '<tr><td colspan="9">Aucun log.</td></tr>';
}

function render_audit_log_rows(array $logs): string
{
    $rows = '';
    foreach ($logs as $log) {
        $outcome = (string) $log['outcome'];
        $tone = match ($outcome) {
            'success' => 'success',
            'blocked' => 'warning',
            'failed' => 'danger',
            default => 'neutral',
        };
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td>' . h((string) $log['actor_role']) . '</td><td>' . h((string) ($log['actor_user_id'] ?? '')) . '</td><td><strong>' . h((string) $log['action']) . '</strong></td><td>' . h((string) ($log['target_type'] ?? '')) . '</td><td>' . h((string) ($log['target_id'] ?? '')) . '</td><td>' . admin_log_badge($tone, $outcome) . '</td><td>' . h(admin_log_text((string) ($log['reason'] ?? ''), 120)) . '</td><td><code>' . h(admin_log_text((string) ($log['request_id'] ?? ''), 48)) . '</code></td><td><code>' . h(admin_log_text((string) ($log['metadata_json'] ?? ''), 180)) . '</code></td></tr>';
    }
    return $rows ?: '<tr><td colspan="10">Aucun audit.</td></tr>';
}

function render_stripe_log_rows(array $logs): string
{
    $rows = '';
    foreach ($logs as $log) {
        $status = (string) $log['status'];
        $tone = match ($status) {
            'processed' => 'success',
            'processing', 'received' => 'info',
            'failed' => 'danger',
            'ignored' => 'neutral',
            default => 'warning',
        };
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td><code>' . h((string) $log['stripe_event_id']) . '</code></td><td><strong>' . h((string) $log['event_type']) . '</strong></td><td>' . h((string) ($log['stripe_object_id'] ?? '')) . '</td><td>' . admin_log_badge($tone, $status) . '</td><td>' . (int) $log['attempt_count'] . '</td><td><code>' . h(admin_log_text((string) ($log['payload_hash'] ?? ''), 48)) . '</code></td><td>' . h(admin_log_text((string) ($log['error_message'] ?? ''), 180)) . '</td></tr>';
    }
    return $rows ?: '<tr><td colspan="8">Aucun evenement Stripe.</td></tr>';
}

function render_admin_logs_panel(PDO $pdo): string
{
    $filters = admin_log_filters();
    $scope = (string) $filters['log_scope'];
    $logData = admin_log_datasets($pdo, $filters);
    $appRows = render_app_log_rows($logData['app_rows']);
    $securityRows = render_app_log_rows($logData['security_rows']);
    $auditRows = render_audit_log_rows($logData['audit_rows']);
    $stripeRows = render_stripe_log_rows($logData['stripe_rows']);

    $counts = [
        'security' => count($logData['security_rows']),
        'application' => count($logData['app_rows']),
        'audit' => count($logData['audit_rows']),
        'stripe' => count($logData['stripe_rows']),
    ];

    $levelOptions = '<option value="">Tous</option>';
    foreach (LOG_LEVELS as $option) {
        $levelOptions .= '<option value="' . h($option) . '"' . ($filters['log_level'] === $option ? ' selected' : '') . '>' . h($option) . '</option>';
    }

    $outcomeOptions = '<option value="">Tous</option>';
    foreach (['success', 'failed', 'blocked'] as $option) {
        $outcomeOptions .= '<option value="' . h($option) . '"' . ($filters['log_outcome'] === $option ? ' selected' : '') . '>' . h($option) . '</option>';
    }

    $stripeStatusOptions = '<option value="">Tous</option>';
    foreach (['received', 'processing', 'processed', 'failed', 'ignored'] as $option) {
        $stripeStatusOptions .= '<option value="' . h($option) . '"' . ($filters['log_stripe_status'] === $option ? ' selected' : '') . '>' . h($option) . '</option>';
    }

    $limitOptions = '';
    foreach ([50, 100, 200, 500] as $option) {
        $limitOptions .= '<option value="' . $option . '"' . ((int) $filters['log_limit'] === $option ? ' selected' : '') . '>' . $option . '</option>';
    }

    $channelOptions = '<option value="">Tous</option>';
    $channelStmt = $pdo->query('SELECT DISTINCT channel FROM app_logs WHERE channel IS NOT NULL AND channel <> "" ORDER BY channel ASC LIMIT 30');
    foreach ($channelStmt->fetchAll(PDO::FETCH_COLUMN) as $option) {
        $channelOptions .= '<option value="' . h((string) $option) . '"' . ($filters['log_channel'] === (string) $option ? ' selected' : '') . '>' . h((string) $option) . '</option>';
    }

    $actorRoleOptions = '<option value="">Tous</option>';
    $actorRoleStmt = $pdo->query('SELECT DISTINCT actor_role FROM audit_logs WHERE actor_role IS NOT NULL AND actor_role <> "" ORDER BY actor_role ASC LIMIT 20');
    foreach ($actorRoleStmt->fetchAll(PDO::FETCH_COLUMN) as $option) {
        $actorRoleOptions .= '<option value="' . h((string) $option) . '"' . ($filters['log_actor_role'] === (string) $option ? ' selected' : '') . '>' . h((string) $option) . '</option>';
    }

    $targetTypeOptions = '<option value="">Toutes</option>';
    $targetTypeStmt = $pdo->query('SELECT DISTINCT target_type FROM audit_logs WHERE target_type IS NOT NULL AND target_type <> "" ORDER BY target_type ASC LIMIT 25');
    foreach ($targetTypeStmt->fetchAll(PDO::FETCH_COLUMN) as $option) {
        $targetTypeOptions .= '<option value="' . h((string) $option) . '"' . ($filters['log_target_type'] === (string) $option ? ' selected' : '') . '>' . h((string) $option) . '</option>';
    }

    $advancedFiltersOpen = false;
    foreach (['log_channel', 'log_event', 'log_user_id', 'log_http_status', 'log_request_id', 'log_actor_role', 'log_action', 'log_target_type', 'log_outcome', 'log_stripe_status', 'log_stripe_type'] as $key) {
        if (trim((string) ($filters[$key] ?? '')) !== '') {
            $advancedFiltersOpen = true;
            break;
        }
    }

    $appSections = '
      <div class="section-heading log-section-heading"><div><h3>Alertes</h3><p>Evenements de securite, refus d acces et erreurs a prioriser.</p></div><div>' . admin_log_badge('warning', (string) $counts['security']) . '</div></div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Niveau</th><th>Channel</th><th>Event</th><th>Message</th><th>User</th><th>HTTP</th><th>Request</th><th>Contexte</th></tr></thead><tbody>' . $securityRows . '</tbody></table></div>
      <div class="section-heading log-section-heading"><div><h3>Application</h3><p>Trace technique des API, auth, emails, exports et erreurs runtime.</p></div><div>' . admin_log_badge('info', (string) $counts['application']) . '</div></div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Niveau</th><th>Channel</th><th>Event</th><th>Message</th><th>User</th><th>HTTP</th><th>Request</th><th>Contexte</th></tr></thead><tbody>' . $appRows . '</tbody></table></div>
    ';

    $auditSection = '
      <section class="panel">
        <div class="section-heading log-section-heading"><div><h2>Audit actions</h2><p>Qui a fait quoi, sur quelle cible, avec quel resultat.</p></div><div>' . admin_log_badge('neutral', (string) $counts['audit']) . '</div></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Role</th><th>Acteur</th><th>Action</th><th>Cible</th><th>ID</th><th>Issue</th><th>Raison</th><th>Request</th><th>Meta</th></tr></thead><tbody>' . $auditRows . '</tbody></table></div>
      </section>
    ';

    $stripeSection = '
      <section class="panel">
        <div class="section-heading log-section-heading"><div><h2>Stripe events</h2><p>Reception, traitement et echecs des webhooks et operations paiement.</p></div><div>' . admin_log_badge('neutral', (string) $counts['stripe']) . '</div></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Event ID</th><th>Type</th><th>Objet</th><th>Statut</th><th>Essais</th><th>Payload hash</th><th>Erreur</th></tr></thead><tbody>' . $stripeRows . '</tbody></table></div>
      </section>
    ';

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Logs applicatifs</h2>
            <p>Evenements techniques, securite, audit, Stripe et client. Les IP/courriels sensibles sont hashes.</p>
          </div>
          <div class="form-actions">
            ' . admin_log_export_links() . '
            <a class="secondary compact-link" href="' . h(admin_log_filter_link()) . '">Reinitialiser filtres</a>
          </div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>Alertes</span><strong>' . $counts['security'] . '</strong></div>
          <div class="stat"><span>Application</span><strong>' . $counts['application'] . '</strong></div>
          <div class="stat"><span>Audit</span><strong>' . $counts['audit'] . '</strong></div>
          <div class="stat"><span>Stripe</span><strong>' . $counts['stripe'] . '</strong></div>
        </div>
        ' . admin_log_scope_nav($filters, $counts) . '
        <form class="log-filter-stack" method="get" action="/admin#admin-logs">
          ' . admin_key_input() . '
          <input type="hidden" name="log_scope" value="' . h($scope) . '">
          <div class="admin-directory-form admin-log-filters">
          <label><span>Niveau</span><select name="log_level">' . $levelOptions . '</select></label>
          <label class="span-2"><span>Recherche</span><input type="search" name="log_q" value="' . h((string) $filters['log_q']) . '" placeholder="message, contexte, request_id, metadata"></label>
          <label><span>Date debut</span><input type="date" name="log_date_from" value="' . h((string) $filters['log_date_from']) . '"></label>
          <label><span>Date fin</span><input type="date" name="log_date_to" value="' . h((string) $filters['log_date_to']) . '"></label>
          <label><span>Limite</span><select name="log_limit">' . $limitOptions . '</select></label>
          <button type="submit">Appliquer</button>
          </div>
          <details class="log-filter-details"' . ($advancedFiltersOpen ? ' open' : '') . '>
            <summary>Filtres avances pour ' . h(strtolower(admin_log_scope_label($scope))) . '</summary>
            <div class="admin-directory-form admin-log-filters advanced">
          <label><span>Channel</span><select name="log_channel">' . $channelOptions . '</select></label>
          <label><span>Event</span><input type="search" name="log_event" value="' . h((string) $filters['log_event']) . '" placeholder="login_failed"></label>
          <label><span>User ID</span><input type="number" min="1" name="log_user_id" value="' . h((string) $filters['log_user_id']) . '" placeholder="8"></label>
          <label><span>HTTP status</span><input type="number" min="100" max="599" name="log_http_status" value="' . h((string) $filters['log_http_status']) . '" placeholder="403"></label>
          <label><span>Request ID</span><input type="search" name="log_request_id" value="' . h((string) $filters['log_request_id']) . '" placeholder="trace ou fragment"></label>
          <label><span>Role audit</span><select name="log_actor_role">' . $actorRoleOptions . '</select></label>
          <label><span>Action audit</span><input type="search" name="log_action" value="' . h((string) $filters['log_action']) . '" placeholder="admin_settings_changed"></label>
          <label><span>Cible audit</span><select name="log_target_type">' . $targetTypeOptions . '</select></label>
          <label><span>Issue audit</span><select name="log_outcome">' . $outcomeOptions . '</select></label>
          <label><span>Statut Stripe</span><select name="log_stripe_status">' . $stripeStatusOptions . '</select></label>
          <label><span>Type Stripe</span><input type="search" name="log_stripe_type" value="' . h((string) $filters['log_stripe_type']) . '" placeholder="invoice, checkout, customer"></label>
            </div>
          </details>
          ' . admin_log_filter_summary($filters) . '
        </form>
        ' . ($scope !== 'audit' && $scope !== 'stripe' ? $appSections : '') . '
      </section>
      ' . ($scope === 'all' || $scope === 'audit' ? $auditSection : '') . '
      ' . ($scope === 'all' || $scope === 'stripe' ? $stripeSection : '') . '
    ';
}

function render_admin_page(): void
{
    if (!admin_allowed()) {
        if (function_exists('app_log')) {
            app_log(db(), 'security', 'admin', 'admin_access_denied', 'GET admin refuse', [], null, 403);
        }
        http_response_code(403);
        page_response('Admin', '
          <section class="page-title">
            <p class="eyebrow">Back-office</p>
            <h1>Admin protege</h1>
            <p>Configure `NICHOIR_ADMIN_KEY` cote serveur et ouvre `/admin?key=...` pour acceder au back-office.</p>
          </section>
        ', '/admin', 403);
        return;
    }

    $pdo = db();
    $summary = admin_summary();
    $selected = selected_admin_user($pdo);
    $notice = trim((string) ($_GET['notice'] ?? ''));
    $exports = $pdo->query('SELECT export_authorizations.id, users.id AS user_id, users.email, export_type, credit_cost, export_authorizations.status AS export_status, export_authorizations.created_at, consumed_at FROM export_authorizations JOIN users ON users.id = export_authorizations.user_id ORDER BY export_authorizations.id DESC LIMIT 20')->fetchAll();

    $exportRows = '';
    $authorizedExportCount = 0;
    $consumedExportCount = 0;
    $revokedExportCount = 0;
    $exportCreditTotal = 0;
    foreach ($exports as $export) {
        $clientHref = admin_client_modal_url((int) $export['user_id'], 'admin-exports', 'exports');
        $status = (string) $export['export_status'];
        if ($status === 'authorized') {
            $authorizedExportCount++;
        } elseif ($status === 'consumed') {
            $consumedExportCount++;
            $exportCreditTotal += (int) $export['credit_cost'];
        } elseif ($status === 'revoked') {
            $revokedExportCount++;
        }
        $exportRows .= '<tr><td>' . (int) $export['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $export['email']) . '</a></td><td><strong>' . h((string) $export['export_type']) . '</strong></td><td>' . (int) $export['credit_cost'] . '</td><td>' . admin_log_badge(admin_export_status_tone($status), admin_export_status_label($status)) . '</td><td>' . h((string) $export['created_at']) . '</td><td>' . h((string) ($export['consumed_at'] ?: '-')) . '</td></tr>';
    }
    if ($exportRows === '') {
        $exportRows = '<tr><td colspan="7">Aucune autorisation.</td></tr>';
    }

    page_response('Admin', '
      <section class="page-title">
        <p class="eyebrow">Back-office</p>
        <h1>Admin</h1>
        <p>Vue dev minimale. En local, l admin est ouvert; en production, definir `NICHOIR_ADMIN_KEY`.</p>
      </section>
      ' . ($notice !== '' ? '<p class="notice">' . h($notice) . '</p>' : '') . '
      <section class="metrics">
        <div><span>Clients</span><strong>' . $summary['users'] . '</strong></div>
        <div><span>Credits totaux</span><strong>' . $summary['credits'] . '</strong></div>
        <div><span>Exports demandes</span><strong>' . $summary['exports'] . '</strong></div>
        <a href="#admin-support" data-tab-target="admin-support"><span>Tickets ouverts</span><strong>' . $summary['tickets'] . '</strong></a>
        <div><span>Abonnements actifs</span><strong>' . $summary['subscriptions'] . '</strong></div>
        <div><span>Paiements recus</span><strong>' . h(money_cents((int) $summary['payments'], 'cad')) . '</strong></div>
      </section>
      <nav class="tab-nav" data-tab-nav role="tablist" aria-label="Sections admin">
        <a role="tab" aria-selected="true" data-tab-target="admin-support" href="#admin-support">Support</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-clients" href="#admin-clients">Clients</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-billing" href="#admin-billing">Billing</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-exports" href="#admin-exports">Exports</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-logs" href="#admin-logs">Logs</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-settings" href="#admin-settings">Reglages</a>
      </nav>
      <section class="tab-panel" id="admin-support" data-tab-panel>
        ' . render_admin_support_panel($pdo) . '
      </section>
      <section class="tab-panel" id="admin-clients" data-tab-panel hidden>
        ' . render_create_user_panel() . '
        ' . render_user_directory($pdo) . '
      </section>
      <section class="tab-panel" id="admin-billing" data-tab-panel hidden>
        ' . render_admin_billing_panel($pdo) . '
      </section>
      <section class="tab-panel" id="admin-exports" data-tab-panel hidden>
        ' . render_admin_database_export_panel() . '
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>Autorisations recentes</h2>
              <p>Historique court des autorisations d export, de leur consommation et des credits engages.</p>
            </div>
            <div>' . admin_log_badge('neutral', (string) count($exports)) . '</div>
          </div>
          <div class="stats-grid billing-summary-grid">
            <div class="stat"><span>Autorisees</span><strong>' . $authorizedExportCount . '</strong></div>
            <div class="stat"><span>Consommees</span><strong>' . $consumedExportCount . '</strong></div>
            <div class="stat"><span>Revoquees</span><strong>' . $revokedExportCount . '</strong></div>
            <div class="stat"><span>Credits engages</span><strong>' . $exportCreditTotal . '</strong></div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Type</th><th>Cout</th><th>Etat</th><th>Cree</th><th>Consomme</th></tr></thead><tbody>' . $exportRows . '</tbody></table></div>
        </section>
      </section>
      <section class="tab-panel" id="admin-logs" data-tab-panel hidden>
        ' . render_admin_logs_panel($pdo) . '
      </section>
      <section class="tab-panel" id="admin-settings" data-tab-panel hidden>
        ' . render_admin_settings_panel($pdo) . '
      </section>
      ' . render_admin_modal($pdo, $selected) . '
    ', '/admin');
}
