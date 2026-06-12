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
        <p>Profil, credits, abonnement et tickets. Les factures arriveront avec Stripe Checkout et le webhook.</p>
      </section>
      <section class="panel account-panel">
        <div class="stat"><span>Etat</span><strong data-account-state>Non connecte</strong></div>
        <div class="stat"><span>Courriel</span><strong data-account-email>-</strong></div>
        <div class="stat"><span>Credits</span><strong data-account-credits>0</strong></div>
        <div class="stat"><span>Abonnement</span><strong data-account-plan>none</strong></div>
        <p data-account-message>Connecte-toi pour charger ton compte.</p>
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
      </section>

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
          <h2>Checkout placeholder</h2>
          <p>Le lien Stripe est genere cote PHP. Aucun paiement n est marque paye tant que le webhook reel n est pas branche.</p>
          <div class="form-actions billing-actions">
            <button type="button" data-billing-offer="credits">Credits</button>
            <button type="button" data-billing-offer="atelier">Atelier</button>
          </div>
          <p data-checkout-message></p>
        </div>
      </section>

      <section class="panel">
        <h2>Factures et paiements</h2>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Montant</th><th>Etat</th><th>Description</th><th>Date</th></tr></thead><tbody data-payment-rows><tr><td colspan="5">Non connecte.</td></tr></tbody></table></div>
      </section>

      <section class="panel">
        <h2>Tickets</h2>
        <form class="client-form ticket-form" data-ticket-form>
          <label><span>Sujet</span><input name="subject" type="text" placeholder="Question sur un export" maxlength="140" required></label>
          <label><span>Message</span><textarea name="body" rows="4" placeholder="Decris le probleme ou la demande" maxlength="5000" required></textarea></label>
          <button type="submit">Envoyer ticket</button>
        </form>
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
            <button type="submit">Repondre</button>
          </form>
        </div>
      </section>

      <section class="grid">
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

      async function loadAccount() {
        const message = document.querySelector("[data-account-message]");
        if (!token()) {
          selectedTicketId = null;
          selectedTicket = null;
          setText("[data-account-state]", "Non connecte");
          setText("[data-account-email]", "-");
          setText("[data-account-credits]", "0");
          setText("[data-account-plan]", "none");
          setText("[data-billing-plan]", "none");
          setText("[data-billing-status]", "none");
          setText("[data-billing-period]", "-");
          document.querySelector("[data-ledger-rows]").innerHTML = `<tr><td colspan="4">Non connecte.</td></tr>`;
          document.querySelector("[data-payment-rows]").innerHTML = `<tr><td colspan="5">Non connecte.</td></tr>`;
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
          const ledger = await api("/api/credits/ledger");
          document.querySelector("[data-ledger-rows]").innerHTML = ledger.ledger.length
            ? ledger.ledger.map((item) => row([item.delta, item.reason, item.reference || "-", item.created_at])).join("")
            : `<tr><td colspan="4">Aucun mouvement.</td></tr>`;
          const billing = await api("/api/billing/summary");
          setText("[data-billing-plan]", billing.subscription.plan || "none");
          setText("[data-billing-status]", billing.subscription.status || "none");
          setText("[data-billing-period]", billing.subscription.current_period_end || "-");
          document.querySelector("[data-payment-rows]").innerHTML = billing.payments.length
            ? billing.payments.map((item) => row([item.id, `${(item.amount_cents / 100).toFixed(2)} ${String(item.currency).toUpperCase()}`, item.status, item.description || "-", item.created_at])).join("")
            : `<tr><td colspan="5">Aucun paiement synchronise.</td></tr>`;
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
          document.querySelector("[data-account-message]").textContent = `Connexion refusee: ${err.message || err}`;
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
          localStorage.setItem(TOKEN_KEY, payload.token);
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = `Inscription refusee: ${err.message || err}`;
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
            document.querySelector("[data-checkout-message]").textContent = `Placeholder ${payload.offer}: ${payload.checkout_url}`;
          } catch (err) {
            document.querySelector("[data-checkout-message]").textContent = `Checkout refuse: ${err.message || err}`;
          }
        });
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
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, credits, status) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, $credits, $status]);
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
        $pdo->prepare('UPDATE users SET email = ?, display_name = ?, status = ?, credits = ? WHERE id = ?')
            ->execute([$email, $name, $status, $credits, $userId]);
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
    if (!in_array($status, ['active', 'suspended'], true)) {
        redirect_admin($userId, 'statut_invalide');
        return;
    }
    $pdo->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $userId]);
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
        $href = admin_redirect_url(['user_id' => (int) $user['id']]);
        $rows .= '<tr><td><a href="' . h($href) . '">' . (int) $user['id'] . '</a></td><td>' . h((string) $user['email']) . '</td><td>' . h((string) $user['display_name']) . '</td><td>' . (int) $user['credits'] . '</td><td>' . h((string) $user['subscription_status']) . '</td><td>' . h((string) ($user['status'] ?? 'active')) . '</td><td>' . h((string) $user['created_at']) . '</td><td><a href="' . h($href) . '">Ouvrir</a></td></tr>';
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

function render_client_detail(PDO $pdo, ?array $user): string
{
    if ($user === null) {
        return '<section class="panel"><h2>Fiche client</h2><p>Selectionne un client ou cherche par courriel.</p></section>';
    }

    $userId = (int) $user['id'];
    $ledger = $pdo->prepare('SELECT delta, reason, reference, created_at FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 20');
    $ledger->execute([$userId]);
    $exports = $pdo->prepare('SELECT export_type, credit_cost, status, created_at, consumed_at FROM export_authorizations WHERE user_id = ? ORDER BY id DESC LIMIT 20');
    $exports->execute([$userId]);
    $tickets = $pdo->prepare('SELECT id, subject, status, priority, assigned_to, created_at, updated_at FROM tickets WHERE user_id = ? ORDER BY id DESC LIMIT 20');
    $tickets->execute([$userId]);
    $audits = $pdo->prepare('SELECT action, delta, note, created_at FROM admin_audit_log WHERE user_id = ? ORDER BY id DESC LIMIT 20');
    $audits->execute([$userId]);
    $subscriptions = $pdo->prepare('SELECT plan, status, provider, current_period_end, cancel_at_period_end, updated_at FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 5');
    $subscriptions->execute([$userId]);
    $payments = $pdo->prepare('SELECT id, amount_cents, currency, status, description, created_at FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 10');
    $payments->execute([$userId]);

    $ledgerRows = '';
    foreach ($ledger->fetchAll() as $row) {
        $ledgerRows .= '<tr><td>' . (int) $row['delta'] . '</td><td>' . h((string) $row['reason']) . '</td><td>' . h((string) $row['reference']) . '</td><td>' . h((string) $row['created_at']) . '</td></tr>';
    }
    $ledgerRows = $ledgerRows ?: '<tr><td colspan="4">Aucune entree.</td></tr>';

    $exportRows = '';
    foreach ($exports->fetchAll() as $row) {
        $exportRows .= '<tr><td>' . h((string) $row['export_type']) . '</td><td>' . (int) $row['credit_cost'] . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) $row['created_at']) . '</td><td>' . h((string) ($row['consumed_at'] ?: '-')) . '</td></tr>';
    }
    $exportRows = $exportRows ?: '<tr><td colspan="5">Aucun export.</td></tr>';

    $ticketRows = '';
    $ticketItems = $tickets->fetchAll();
    $selectedTicketId = (int) ($_GET['ticket_id'] ?? 0);
    if ($selectedTicketId <= 0 && isset($ticketItems[0])) {
        $selectedTicketId = (int) $ticketItems[0]['id'];
    }
    foreach ($ticketItems as $row) {
        $href = admin_redirect_url(['user_id' => $userId, 'ticket_id' => (int) $row['id']]);
        $selectedClass = (int) $row['id'] === $selectedTicketId ? ' class="selected-row"' : '';
        $ticketRows .= '<tr' . $selectedClass . '><td><a href="' . h($href) . '">#' . (int) $row['id'] . '</a></td><td>' . h((string) $row['subject']) . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) $row['priority']) . '</td><td>' . h((string) ($row['assigned_to'] ?: '-')) . '</td><td>' . h((string) $row['updated_at']) . '</td><td><a href="' . h($href) . '">Ouvrir</a></td></tr>';
    }
    $ticketRows = $ticketRows ?: '<tr><td colspan="7">Aucun ticket.</td></tr>';

    $selectedTicket = $selectedTicketId > 0 ? admin_load_ticket($pdo, $selectedTicketId, $userId) : null;
    $ticketThread = '<p>Aucun ticket selectionne.</p>';
    if ($selectedTicket !== null) {
        $messageStmt = $pdo->prepare('SELECT id, author_role, body, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY id ASC');
        $messageStmt->execute([(int) $selectedTicket['id']]);
        $messageRows = '';
        foreach ($messageStmt->fetchAll() as $message) {
            $role = (string) ($message['author_role'] ?: 'client');
            $messageRows .= '<article class="ticket-message ' . h($role) . '"><header><strong>' . h($role === 'admin' ? 'Support' : 'Client') . '</strong><span>' . h((string) $message['created_at']) . '</span></header><p>' . nl2br(h((string) $message['body'])) . '</p></article>';
        }
        $messageRows = $messageRows ?: '<p>Aucun message.</p>';
        $statusOptions = ticket_status_options((string) $selectedTicket['status']);
        $priorityOptions = ticket_priority_options((string) ($selectedTicket['priority'] ?? 'normal'));
        $disabledReply = (string) $selectedTicket['status'] === 'open' ? '' : ' disabled';
        $ticketThread = '
          <div class="ticket-detail-header">
            <div>
              <h3>#' . (int) $selectedTicket['id'] . ' - ' . h((string) $selectedTicket['subject']) . '</h3>
              <p>Statut: ' . h((string) $selectedTicket['status']) . ' · Priorite: ' . h((string) ($selectedTicket['priority'] ?? 'normal')) . ' · Assigne: ' . h((string) ($selectedTicket['assigned_to'] ?: '-')) . '</p>
            </div>
          </div>
          <div class="ticket-thread">' . $messageRows . '</div>
          <div class="ticket-admin-forms">
            <form method="post" action="/admin">
              ' . admin_key_input() . '
              <input type="hidden" name="action" value="reply_ticket">
              <input type="hidden" name="user_id" value="' . $userId . '">
              <input type="hidden" name="ticket_id" value="' . (int) $selectedTicket['id'] . '">
              <label><span>Reponse support</span><textarea name="body" maxlength="5000" rows="4"' . $disabledReply . '></textarea></label>
              <button type="submit"' . $disabledReply . '>Repondre</button>
            </form>
            <form method="post" action="/admin">
              ' . admin_key_input() . '
              <input type="hidden" name="action" value="set_ticket_status">
              <input type="hidden" name="user_id" value="' . $userId . '">
              <input type="hidden" name="ticket_id" value="' . (int) $selectedTicket['id'] . '">
              <label><span>Statut</span><select name="ticket_status">' . $statusOptions . '</select></label>
              <button type="submit">Changer statut</button>
            </form>
            <form method="post" action="/admin">
              ' . admin_key_input() . '
              <input type="hidden" name="action" value="update_ticket_meta">
              <input type="hidden" name="user_id" value="' . $userId . '">
              <input type="hidden" name="ticket_id" value="' . (int) $selectedTicket['id'] . '">
              <label><span>Priorite</span><select name="priority">' . $priorityOptions . '</select></label>
              <label><span>Assigne a</span><input type="text" name="assigned_to" maxlength="120" value="' . h((string) ($selectedTicket['assigned_to'] ?? '')) . '"></label>
              <button type="submit">Mettre a jour</button>
            </form>
          </div>
        ';
    }

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
        $paymentRows .= '<tr><td>' . (int) $row['id'] . '</td><td>' . h(money_cents((int) $row['amount_cents'], (string) $row['currency'])) . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) $row['description']) . '</td><td>' . h((string) $row['created_at']) . '</td></tr>';
    }
    $paymentRows = $paymentRows ?: '<tr><td colspan="5">Aucun paiement synchronise.</td></tr>';

    $auditRows = '';
    foreach ($audits->fetchAll() as $row) {
        $auditRows .= '<tr><td>' . h((string) $row['action']) . '</td><td>' . h((string) ($row['delta'] ?? '-')) . '</td><td>' . h((string) $row['note']) . '</td><td>' . h((string) $row['created_at']) . '</td></tr>';
    }
    $auditRows = $auditRows ?: '<tr><td colspan="4">Aucune action admin.</td></tr>';

    $status = (string) ($user['status'] ?? 'active');
    $nextStatus = $status === 'active' ? 'suspended' : 'active';
    $nextLabel = $nextStatus === 'active' ? 'Reactiver' : 'Suspendre';
    $userStatusOptions = admin_status_options($status);
    $planOptions = admin_plan_options((string) $latestSubscription['plan']);
    $subscriptionStatusOptions = admin_subscription_status_options((string) $latestSubscription['status']);
    $periodValue = h(substr((string) ($latestSubscription['current_period_end'] ?? ''), 0, 10));

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
            <label><span>Courriel</span><input type="email" name="email" value="' . h((string) $user['email']) . '" required></label>
            <label><span>Nom</span><input type="text" name="display_name" value="' . h((string) $user['display_name']) . '"></label>
            <label><span>Statut</span><select name="status">' . $userStatusOptions . '</select></label>
            <label><span>Solde credits</span><input type="number" name="credits" min="0" step="1" value="' . (int) $user['credits'] . '" required></label>
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
            <input type="hidden" name="action" value="adjust_credits">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <label><span>Ajustement credits</span><input type="number" name="delta" step="1" required></label>
            <label><span>Note</span><input type="text" name="note" placeholder="raison interne"></label>
            <button type="submit">Appliquer</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="set_status">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <input type="hidden" name="status" value="' . h($nextStatus) . '">
            <button type="submit">' . h($nextLabel) . '</button>
          </form>
          <form class="span-all subscription-form" method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="set_subscription">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <label><span>Plan</span><select name="plan">' . $planOptions . '</select></label>
            <label><span>Etat abonnement</span><select name="subscription_status">' . $subscriptionStatusOptions . '</select></label>
            <label><span>Fin periode</span><input type="date" name="current_period_end" value="' . $periodValue . '"></label>
            <button type="submit">Mettre a jour abonnement</button>
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
      <section class="panel"><h2>Historique credits</h2><div class="table-wrap"><table><thead><tr><th>Delta</th><th>Raison</th><th>Reference</th><th>Date</th></tr></thead><tbody>' . $ledgerRows . '</tbody></table></div></section>
      <section class="panel"><h2>Abonnements client</h2><div class="table-wrap"><table><thead><tr><th>Plan</th><th>Etat</th><th>Provider</th><th>Fin periode</th><th>Annule fin</th><th>MAJ</th></tr></thead><tbody>' . $subscriptionRows . '</tbody></table></div></section>
      <section class="panel"><h2>Paiements client</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Montant</th><th>Etat</th><th>Description</th><th>Date</th></tr></thead><tbody>' . $paymentRows . '</tbody></table></div></section>
      <section class="panel"><h2>Exports client</h2><div class="table-wrap"><table><thead><tr><th>Type</th><th>Cout</th><th>Etat</th><th>Cree</th><th>Consomme</th></tr></thead><tbody>' . $exportRows . '</tbody></table></div></section>
      <section class="panel"><h2>Tickets client</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Sujet</th><th>Etat</th><th>Priorite</th><th>Assigne</th><th>MAJ</th><th></th></tr></thead><tbody>' . $ticketRows . '</tbody></table></div></section>
      <section class="panel ticket-panel"><h2>Fil ticket</h2>' . $ticketThread . '</section>
      <section class="panel"><h2>Audit admin</h2><div class="table-wrap"><table><thead><tr><th>Action</th><th>Delta</th><th>Note</th><th>Date</th></tr></thead><tbody>' . $auditRows . '</tbody></table></div></section>
    ';
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
    $exports = $pdo->query('SELECT export_authorizations.id, users.email, export_type, credit_cost, export_authorizations.status AS export_status, export_authorizations.created_at, consumed_at FROM export_authorizations JOIN users ON users.id = export_authorizations.user_id ORDER BY export_authorizations.id DESC LIMIT 20')->fetchAll();
    $subscriptions = $pdo->query('SELECT subscriptions.id, users.email, plan, subscriptions.status AS subscription_state, current_period_end, subscriptions.updated_at FROM subscriptions JOIN users ON users.id = subscriptions.user_id ORDER BY subscriptions.id DESC LIMIT 20')->fetchAll();
    $payments = $pdo->query('SELECT payments.id, users.email, amount_cents, currency, payments.status AS payment_state, description, payments.created_at FROM payments JOIN users ON users.id = payments.user_id ORDER BY payments.id DESC LIMIT 20')->fetchAll();

    $exportRows = '';
    foreach ($exports as $export) {
        $exportRows .= '<tr><td>' . (int) $export['id'] . '</td><td>' . h((string) $export['email']) . '</td><td>' . h((string) $export['export_type']) . '</td><td>' . (int) $export['credit_cost'] . '</td><td>' . h((string) $export['export_status']) . '</td><td>' . h((string) ($export['consumed_at'] ?: '-')) . '</td></tr>';
    }
    if ($exportRows === '') {
        $exportRows = '<tr><td colspan="6">Aucune autorisation.</td></tr>';
    }

    $subscriptionRows = '';
    foreach ($subscriptions as $subscription) {
        $subscriptionRows .= '<tr><td>' . (int) $subscription['id'] . '</td><td>' . h((string) $subscription['email']) . '</td><td>' . h((string) $subscription['plan']) . '</td><td>' . h((string) $subscription['subscription_state']) . '</td><td>' . h((string) ($subscription['current_period_end'] ?: '-')) . '</td><td>' . h((string) $subscription['updated_at']) . '</td></tr>';
    }
    if ($subscriptionRows === '') {
        $subscriptionRows = '<tr><td colspan="6">Aucun abonnement.</td></tr>';
    }

    $paymentRows = '';
    foreach ($payments as $payment) {
        $paymentRows .= '<tr><td>' . (int) $payment['id'] . '</td><td>' . h((string) $payment['email']) . '</td><td>' . h(money_cents((int) $payment['amount_cents'], (string) $payment['currency'])) . '</td><td>' . h((string) $payment['payment_state']) . '</td><td>' . h((string) $payment['description']) . '</td><td>' . h((string) $payment['created_at']) . '</td></tr>';
    }
    if ($paymentRows === '') {
        $paymentRows = '<tr><td colspan="6">Aucun paiement.</td></tr>';
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
        <div><span>Tickets ouverts</span><strong>' . $summary['tickets'] . '</strong></div>
        <div><span>Abonnements actifs</span><strong>' . $summary['subscriptions'] . '</strong></div>
        <div><span>Paiements recus</span><strong>' . h(money_cents((int) $summary['payments'], 'cad')) . '</strong></div>
      </section>
      ' . render_email_settings_panel($pdo) . '
      ' . render_create_user_panel() . '
      ' . render_user_directory($pdo) . '
      ' . render_client_detail($pdo, $selected) . '
      <section class="panel"><h2>Abonnements recents</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Plan</th><th>Etat</th><th>Fin periode</th><th>MAJ</th></tr></thead><tbody>' . $subscriptionRows . '</tbody></table></div></section>
      <section class="panel"><h2>Paiements recents</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Montant</th><th>Etat</th><th>Description</th><th>Date</th></tr></thead><tbody>' . $paymentRows . '</tbody></table></div></section>
      <section class="panel"><h2>Autorisations recentes</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Type</th><th>Cout</th><th>Etat</th><th>Consomme</th></tr></thead><tbody>' . $exportRows . '</tbody></table></div></section>
    ', '/admin');
}
