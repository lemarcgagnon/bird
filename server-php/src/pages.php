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
    'closed' => 'Ferme',
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
          account_pending: "Compte en attente: entre le code recu par email.",
          activation_email_failed: "Email activation non envoye. Configure SMTP dans Admin > Reglages.",
          activation_code_expired: "Code expire. Renvoie un nouveau code.",
          activation_resend_wait: "Attends une minute avant de renvoyer un code.",
          invalid_activation_code: "Code activation invalide.",
          invalid_activation: "Compte a activer introuvable.",
          email_exists: "Ce courriel existe deja.",
          invalid_credentials: "Courriel ou mot de passe invalide.",
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
          document.querySelector("[data-account-message]").textContent = "Compte cree. Code activation envoye par email.";
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
    $allowed = ['admin-support', 'admin-clients', 'admin-billing', 'admin-exports', 'admin-settings'];
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function admin_client_panel_value(string $value): string
{
    $allowed = ['profile', 'credits', 'billing', 'exports'];
    return in_array($value, $allowed, true) ? $value : 'profile';
}

function admin_client_modal_url(int $userId, string $returnTab = 'admin-clients', string $panel = 'profile'): string
{
    $returnTab = admin_tab_value($returnTab);
    return admin_redirect_url([
        'user_id' => $userId,
        'return_tab' => $returnTab,
        'client_panel' => admin_client_panel_value($panel),
    ]) . '#' . $returnTab;
}

function admin_export_scope_value(string $value): string
{
    $allowed = ['all', 'clients', 'billing', 'support', 'credits', 'exports'];
    return in_array($value, $allowed, true) ? $value : 'exports';
}

function admin_export_format_value(string $value): string
{
    $format = strtolower(trim($value));
    if ($format === 'excel') {
        return 'xls';
    }
    return in_array($format, ['csv', 'json', 'xls'], true) ? $format : 'csv';
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
        audit_admin_action($pdo, $userId, 'delete_user', null, $email);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
        $pdo->commit();
        header('Location: ' . admin_redirect_url(['notice' => 'client_supprime']));
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
    $pdo->prepare(
        "UPDATE users
         SET status = ?,
             email_verified_at = CASE WHEN ? <> 'pending' AND email_verified_at IS NULL THEN CURRENT_TIMESTAMP ELSE email_verified_at END,
             email_verification_code_hash = CASE WHEN ? <> 'pending' THEN '' ELSE email_verification_code_hash END,
             email_verification_expires_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_expires_at END,
             email_verification_sent_at = CASE WHEN ? <> 'pending' THEN NULL ELSE email_verification_sent_at END
         WHERE id = ?"
    )->execute([$status, $status, $status, $status, $status, $userId]);
    audit_admin_action($pdo, $userId, 'set_status', null, $status);
    redirect_admin($userId, 'statut_modifie');
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
            <label><span>Suppression definitive</span><input type="text" name="confirm" placeholder="taper DELETE pour confirmer"></label>
            <button type="submit">Supprimer utilisateur</button>
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

function render_admin_modal_shell(string $title, string $closeHash, string $body): string
{
    $closeUrl = admin_redirect_url() . '#' . $closeHash;
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

function render_client_modal(PDO $pdo, array $user, string $closeHash, string $activePanel): string
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
    return render_admin_modal_shell($title, $closeHash, '
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

    return render_admin_modal_shell('Ticket #' . (int) $ticket['id'] . ' - ' . (string) $ticket['subject'], 'admin-support', '
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
        return render_client_modal($pdo, $selectedUser, $returnTab, $panel);
    }
    return '';
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

    return '
      <section class="panel">
        <h2>Email tickets</h2>
        <p>Configure ici le serveur email cPanel/SMTP utilise pour envoyer les notifications tickets. Les envois sont aussi journalises dans SQLite.</p>
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
        <form class="admin-email-test" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="send_test_email">
          <label><span>Email test</span><input type="email" name="test_recipient" value="' . h((string) $settings['support_email']) . '" required></label>
          <button type="submit">Envoyer test</button>
        </form>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Ticket</th><th>Destinataire</th><th>Sujet</th><th>Etat</th><th>Erreur</th><th>Date</th></tr></thead><tbody>' . $rows . '</tbody></table></div>
      </section>
    ';
}

function render_stripe_settings_panel(PDO $pdo): string
{
    $settings = stripe_settings($pdo);
    $secretNote = stripe_setting_secret_is_env('NICHOIR_STRIPE_SECRET_KEY') ? 'Cle fournie par NICHOIR_STRIPE_SECRET_KEY.' : 'Laisser vide pour conserver la cle actuelle.';
    $webhookNote = stripe_setting_secret_is_env('NICHOIR_STRIPE_WEBHOOK_SECRET') ? 'Secret fourni par NICHOIR_STRIPE_WEBHOOK_SECRET.' : 'Laisser vide pour conserver le secret actuel.';

    return '
      <section class="panel">
        <h2>Stripe billing</h2>
        <p>Configure Checkout, portail client et verification webhook. Les secrets peuvent venir des variables serveur en production.</p>
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

    return '
      <section class="panel">
        <h2>Base de donnees</h2>
        <p>Configure la connexion cPanel/MySQL ici. SQLite reste le mode local par defaut. Enregistrer teste la connexion et cree le schema MySQL si la base est vide.</p>
        <div class="client-summary compact">
          <div class="stat"><span>Driver actif</span><strong>' . h($driver) . '</strong></div>
          <div class="stat"><span>Source</span><strong>' . h($source) . '</strong></div>
          <div class="stat"><span>Config locale</span><strong>' . h(db_config_path()) . '</strong></div>
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
      </section>
    ';
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

    $rows = '';
    foreach ($scopes as $scope => [$label, $description]) {
        $rows .= '
          <tr>
            <td><strong>' . h($label) . '</strong><p>' . h($description) . '</p></td>
            <td>' . render_admin_export_links((string) $scope) . '</td>
          </tr>
        ';
    }

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Exports base de donnees</h2>
            <p>Choisis une portee puis un format. Les lignes sont classees par date descendante et reliees au client quand possible.</p>
          </div>
        </div>
        <div class="table-wrap export-scope-table"><table><thead><tr><th>Portee</th><th>Formats</th></tr></thead><tbody>' . $rows . '</tbody></table></div>
      </section>
    ';
}

function render_admin_page(): void
{
    if (!admin_allowed()) {
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
    $subscriptions = $pdo->query('SELECT subscriptions.id, users.id AS user_id, users.email, plan, subscriptions.status AS subscription_state, current_period_end, subscriptions.updated_at FROM subscriptions JOIN users ON users.id = subscriptions.user_id ORDER BY subscriptions.id DESC LIMIT 20')->fetchAll();
    $payments = $pdo->query('SELECT payments.id, users.id AS user_id, users.email, amount_cents, currency, payments.status AS payment_state, description, invoice_url, invoice_pdf, payments.created_at FROM payments JOIN users ON users.id = payments.user_id ORDER BY payments.id DESC LIMIT 20')->fetchAll();

    $exportRows = '';
    foreach ($exports as $export) {
        $clientHref = admin_client_modal_url((int) $export['user_id'], 'admin-exports', 'exports');
        $exportRows .= '<tr><td>' . (int) $export['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $export['email']) . '</a></td><td>' . h((string) $export['export_type']) . '</td><td>' . (int) $export['credit_cost'] . '</td><td>' . h((string) $export['export_status']) . '</td><td>' . h((string) ($export['consumed_at'] ?: '-')) . '</td></tr>';
    }
    if ($exportRows === '') {
        $exportRows = '<tr><td colspan="6">Aucune autorisation.</td></tr>';
    }

    $subscriptionRows = '';
    foreach ($subscriptions as $subscription) {
        $clientHref = admin_client_modal_url((int) $subscription['user_id'], 'admin-billing', 'billing');
        $subscriptionRows .= '<tr><td>' . (int) $subscription['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $subscription['email']) . '</a></td><td>' . h((string) $subscription['plan']) . '</td><td>' . h((string) $subscription['subscription_state']) . '</td><td>' . h((string) ($subscription['current_period_end'] ?: '-')) . '</td><td>' . h((string) $subscription['updated_at']) . '</td></tr>';
    }
    if ($subscriptionRows === '') {
        $subscriptionRows = '<tr><td colspan="6">Aucun abonnement.</td></tr>';
    }

    $paymentRows = '';
    foreach ($payments as $payment) {
        $clientHref = admin_client_modal_url((int) $payment['user_id'], 'admin-billing', 'billing');
        $invoiceLinks = ((string) $payment['invoice_url'] !== '' ? '<a href="' . h((string) $payment['invoice_url']) . '" target="_blank" rel="noreferrer">Voir</a> ' : '')
            . ((string) $payment['invoice_pdf'] !== '' ? '<a href="' . h((string) $payment['invoice_pdf']) . '" target="_blank" rel="noreferrer">PDF</a>' : '');
        $paymentRows .= '<tr><td>' . (int) $payment['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $payment['email']) . '</a></td><td>' . h(money_cents((int) $payment['amount_cents'], (string) $payment['currency'])) . '</td><td>' . h((string) $payment['payment_state']) . '</td><td>' . h((string) $payment['description']) . '</td><td>' . ($invoiceLinks ?: '-') . '</td><td>' . h((string) $payment['created_at']) . '</td></tr>';
    }
    if ($paymentRows === '') {
        $paymentRows = '<tr><td colspan="7">Aucun paiement.</td></tr>';
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
        <section class="panel"><h2>Abonnements recents</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Plan</th><th>Etat</th><th>Fin periode</th><th>MAJ</th></tr></thead><tbody>' . $subscriptionRows . '</tbody></table></div></section>
        <section class="panel"><h2>Paiements recents</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Montant</th><th>Etat</th><th>Description</th><th>Facture</th><th>Date</th></tr></thead><tbody>' . $paymentRows . '</tbody></table></div></section>
      </section>
      <section class="tab-panel" id="admin-exports" data-tab-panel hidden>
        ' . render_admin_database_export_panel() . '
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>Autorisations recentes</h2>
              <p>Telechargements autorises et consommation des credits.</p>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Type</th><th>Cout</th><th>Etat</th><th>Consomme</th></tr></thead><tbody>' . $exportRows . '</tbody></table></div>
        </section>
      </section>
      <section class="tab-panel" id="admin-settings" data-tab-panel hidden>
        ' . render_database_settings_panel() . '
        ' . render_stripe_settings_panel($pdo) . '
        ' . render_email_settings_panel($pdo) . '
      </section>
      ' . render_admin_modal($pdo, $selected) . '
    ', '/admin');
}
