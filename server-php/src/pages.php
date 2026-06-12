<?php

declare(strict_types=1);

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function current_lang(): string
{
    static $lang = null;
    if ($lang !== null) {
        return $lang;
    }

    $allowed = ['fr', 'en'];
    $queryLang = strtolower(trim((string) ($_GET['lang'] ?? '')));
    if (in_array($queryLang, $allowed, true)) {
        $lang = $queryLang;
        setcookie('nichoir_lang', $lang, [
            'expires' => time() + 31536000,
            'path' => '/',
            'samesite' => 'Lax',
        ]);
        return $lang;
    }

    $cookieLang = strtolower(trim((string) ($_COOKIE['nichoir_lang'] ?? '')));
    if (in_array($cookieLang, $allowed, true)) {
        $lang = $cookieLang;
        return $lang;
    }

    $acceptLanguage = strtolower((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
    $lang = str_starts_with($acceptLanguage, 'en') ? 'en' : 'fr';
    return $lang;
}

function t(string $fr, string $en, array $vars = []): string
{
    $text = current_lang() === 'en' ? $en : $fr;
    if ($vars === []) {
        return $text;
    }
    $replacements = [];
    foreach ($vars as $key => $value) {
        $replacements['{' . $key . '}'] = (string) $value;
    }
    return strtr($text, $replacements);
}

function current_path_with_lang(string $lang): string
{
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';
    $queryText = parse_url($uri, PHP_URL_QUERY);
    $params = [];
    if (is_string($queryText) && $queryText !== '') {
        parse_str($queryText, $params);
    }
    $params['lang'] = $lang;
    return $path . '?' . http_build_query($params);
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
    $lang = current_lang();
    $nav = [
        '/' => t('Accueil', 'Home'),
        '/pricing' => t('Offres', 'Pricing'),
        '/account' => t('Compte', 'Account'),
        '/admin' => 'Admin',
    ];
    echo '<!doctype html><html lang="' . h($lang) . '"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . h($title) . ' - Nichoir</title>';
    echo '<style>';
    echo file_get_contents(__DIR__ . '/../public/site.css') ?: '';
    echo '</style></head><body data-page="' . h($active) . '">';
    echo '<header class="site-header"><a class="brand" href="/">Nichoir</a><nav>';
    foreach ($nav as $href => $label) {
        $class = $active === $href ? ' class="active"' : '';
        echo '<a' . $class . ' href="' . h($href) . '">' . h($label) . '</a>';
    }
    echo '<a class="lang-link' . ($lang === 'fr' ? ' active' : '') . '" href="' . h(current_path_with_lang('fr')) . '" data-lang-link="fr">FR</a>';
    echo '<a class="lang-link' . ($lang === 'en' ? ' active' : '') . '" href="' . h(current_path_with_lang('en')) . '" data-lang-link="en">EN</a>';
    echo '<a class="button-link" href="' . $appUrl . '">' . h(t('Ouvrir app', 'Open app')) . '</a>';
    echo '</nav></header>';
    echo '<main>' . $body . '</main>';
    echo '<footer>' . h(t('Rust/WASM pour les plans et exports. PHP pour comptes, credits, admin et Stripe.', 'Rust/WASM for plans and exports. PHP handles accounts, credits, admin, and Stripe.')) . '</footer>';
    echo '<script>
      (() => {
        const isAdminPage = document.body?.dataset.page === "/admin";
        const adminScrollKey = "nichoir:admin:scroll";

        document.querySelectorAll("[data-lang-link]").forEach((link) => {
          try {
            const url = new URL(link.getAttribute("href"), window.location.origin);
            url.hash = window.location.hash;
            link.setAttribute("href", url.pathname + url.search + url.hash);
          } catch (_err) {
          }
        });

        const saveAdminScroll = () => {
          if (!isAdminPage) return;
          sessionStorage.setItem(adminScrollKey, JSON.stringify({
            path: window.location.pathname,
            y: window.scrollY,
            at: Date.now(),
          }));
        };

        const restoreAdminScroll = () => {
          if (!isAdminPage) return;
          const raw = sessionStorage.getItem(adminScrollKey);
          if (!raw) return;
          try {
            const saved = JSON.parse(raw);
            const freshEnough = typeof saved?.at === "number" && (Date.now() - saved.at) < 15000;
            if (saved?.path === window.location.pathname && typeof saved?.y === "number" && freshEnough) {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  window.scrollTo(0, saved.y);
                });
              });
            }
          } catch (_err) {
          }
          sessionStorage.removeItem(adminScrollKey);
        };

        if (isAdminPage) {
          document.addEventListener("click", (event) => {
            const link = event.target.closest("a[href]");
            if (!link || link.hasAttribute("data-tab-target")) return;
            const href = link.getAttribute("href") || "";
            if (href.startsWith("/admin")) saveAdminScroll();
          }, true);

          document.addEventListener("submit", (event) => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement)) return;
            const action = form.getAttribute("action") || "";
            if (action.startsWith("/admin")) saveAdminScroll();
          }, true);
        }

        const tabNavs = document.querySelectorAll("[data-tab-nav]");
        const activateTabs = () => {
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
        };

        if (tabNavs.length) {
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
        }

        document.addEventListener("change", (event) => {
          const select = event.target.closest("[data-auto-submit-select]");
          if (select && select.form) {
            select.form.requestSubmit();
          }
        });

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
          if (typeof modal.focus === "function") {
            try {
              modal.focus({ preventScroll: true });
            } catch (_err) {
              modal.focus();
            }
          }
          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && modal.dataset.closeUrl) {
              window.location.href = modal.dataset.closeUrl;
            }
          });
        }

        restoreAdminScroll();
      })();
    </script>';
    echo '</body></html>';
}

function render_landing_page(): void
{
    $appUrl = h(dev_app_url());
    page_response(t('Accueil', 'Home'), '
      <section class="hero">
        <p class="eyebrow">' . h(t('Conception parametrique', 'Parametric design')) . '</p>
        <h1>Nichoir</h1>
        <p>' . h(t('Un outil pour concevoir, visualiser et exporter des nichoirs en STL, ZIP panneaux et plans de coupe, avec calculs locaux dans le navigateur.', 'A tool to design, visualize, and export birdhouses as STL, panel ZIPs, and cut plans, with local calculations in the browser.')) . '</p>
        <div class="hero-actions">
          <a class="primary" href="' . $appUrl . '">' . h(t('Ouvrir l app', 'Open the app')) . '</a>
          <a class="secondary" href="/pricing">' . h(t('Voir les offres', 'See pricing')) . '</a>
        </div>
      </section>
      <section class="grid">
        <article><h2>' . h(t('WASM local', 'Local WASM')) . '</h2><p>' . h(t('La geometrie, les plans et les exports restent cote client pour eviter le calcul lourd serveur.', 'Geometry, plans, and exports stay client-side to avoid heavy server computation.')) . '</p></article>
        <article><h2>' . h(t('Credits', 'Credits')) . '</h2><p>' . h(t('Les telechargements premium passent par une autorisation courte et un debit de credits.', 'Premium downloads use short-lived authorization and credit consumption.')) . '</p></article>
        <article><h2>' . h(t('Fabrication', 'Fabrication')) . '</h2><p>' . h(t('Les panneaux, epaisseurs commerciales et traits de scie preparent une fabrication plus realiste.', 'Panels, market thicknesses, and kerf settings prepare a more realistic fabrication workflow.')) . '</p></article>
      </section>
    ', '/');
}

function render_pricing_page(): void
{
    page_response(t('Offres', 'Pricing'), '
      <section class="page-title">
        <p class="eyebrow">' . h(t('Credits et abonnements', 'Credits and subscriptions')) . '</p>
        <h1>' . h(t('Offres', 'Pricing')) . '</h1>
        <p>' . h(t('Stripe est encore placeholder. Ces cartes fixent la structure produit avant Checkout et webhook.', 'Stripe is still a placeholder. These cards define the product structure before Checkout and webhooks.')) . '</p>
      </section>
      <section class="pricing-grid">
        <article><h2>' . h(t('Credits', 'Credits')) . '</h2><strong>' . h(t('A venir', 'Coming soon')) . '</strong><p>' . h(t('Achat ponctuel de credits pour STL, plans PDF, ZIP panneaux et exports image.', 'One-off credit purchases for STL, PDF plans, panel ZIPs, and image exports.')) . '</p></article>
        <article><h2>Atelier</h2><strong>' . h(t('A venir', 'Coming soon')) . '</strong><p>' . h(t('Abonnement pour usage regulier, historique de consommation et support prioritaire.', 'Subscription for regular usage, consumption history, and priority support.')) . '</p></article>
        <article><h2>Pro</h2><strong>' . h(t('A venir', 'Coming soon')) . '</strong><p>' . h(t('Acces plus large, gestion multi-projets et limites commerciales plus hautes.', 'Broader access, multi-project management, and higher commercial limits.')) . '</p></article>
      </section>
      <section class="panel"><h2>' . h(t('Couts dev actuels', 'Current dev costs')) . '</h2><p>' . h(t('STL: 3 credits. PDF: 2 credits. ZIP: 5 credits. SVG/PNG: 1 credit.', 'STL: 3 credits. PDF: 2 credits. ZIP: 5 credits. SVG/PNG: 1 credit.')) . '</p></section>
    ', '/pricing');
}

function render_account_page(): void
{
    $accountI18n = json_encode([
        'activation_unavailable' => t('Activation indisponible. Verifie SMTP dans Admin > Reglages.', 'Activation unavailable. Check SMTP in Admin > Settings.'),
        'activation_failed' => t('Activation refusee. Verifie le courriel/code ou renvoie un nouveau code.', 'Activation denied. Check the email/code or send a new code.'),
        'too_many_requests' => t('Trop de tentatives. Attends quelques minutes puis reessaie.', 'Too many attempts. Wait a few minutes and try again.'),
        'invalid_credentials' => t('Connexion refusee. Verifie le mot de passe ou active le compte avec le code email.', 'Login denied. Check the password or activate the account with the email code.'),
        'signed_out' => t('Non connecte', 'Signed out'),
        'connect_prompt' => t('Connecte-toi pour charger ton compte.', 'Sign in to load your account.'),
        'none' => t('Aucun', 'None'),
        'credits_plan' => t('Credits', 'Credits'),
        'atelier_plan' => 'Atelier',
        'pro_plan' => 'Pro',
        'pending' => t('En attente', 'Pending'),
        'active' => t('Actif', 'Active'),
        'suspended' => t('Suspendu', 'Suspended'),
        'archived' => t('Archive', 'Archived'),
        'canceled' => t('Annule', 'Canceled'),
        'cancelled' => t('Annule', 'Cancelled'),
        'past_due' => t('Paiement en retard', 'Past due'),
        'unpaid' => t('Impaye', 'Unpaid'),
        'trialing' => t('Essai', 'Trial'),
        'incomplete' => t('Incomplet', 'Incomplete'),
        'paid' => t('Paye', 'Paid'),
        'succeeded' => t('Paye', 'Paid'),
        'failed' => t('Echec', 'Failed'),
        'open_state' => t('Ouvert', 'Open'),
        'closed_state' => t('Ferme', 'Closed'),
        'low' => t('Basse', 'Low'),
        'normal' => t('Normale', 'Normal'),
        'high' => t('Haute', 'High'),
        'urgent' => t('Urgente', 'Urgent'),
        'no_ledger' => t('Aucun mouvement.', 'No entry.'),
        'no_payment' => t('Aucun paiement synchronise.', 'No synchronized payment.'),
        'no_ticket' => t('Aucun ticket.', 'No ticket.'),
        'no_message' => t('Aucun message.', 'No message.'),
        'account_loaded' => t('Compte charge.', 'Account loaded.'),
        'invalid_session' => t('Session invalide: {error}', 'Invalid session: {error}'),
        'status_label' => t('Statut', 'Status'),
        'priority_label' => t('Priorite', 'Priority'),
        'updated_label' => t('MAJ', 'Updated'),
        'close' => t('Fermer', 'Close'),
        'reopen' => t('Reouvrir', 'Reopen'),
        'support' => 'Support',
        'client' => t('Client', 'Client'),
        'ticket_not_found' => t('Ticket introuvable: {error}', 'Ticket not found: {error}'),
        'login_denied' => t('Connexion refusee: {error}', 'Login denied: {error}'),
        'register_notice' => t('Si inscription possible, un code activation est envoye par email.', 'If registration is allowed, an activation code has been sent by email.'),
        'register_denied' => t('Inscription refusee: {error}', 'Registration denied: {error}'),
        'account_activated' => t('Compte active.', 'Account activated.'),
        'activation_denied' => t('Activation refusee: {error}', 'Activation denied: {error}'),
        'resend_notice' => t('Si ce compte attend une activation, un nouveau code vient d etre envoye.', 'If this account is waiting for activation, a new code has been sent.'),
        'resend_denied' => t('Renvoi refuse: {error}', 'Resend denied: {error}'),
        'profile_saved' => t('Profil enregistre.', 'Profile saved.'),
        'profile_denied' => t('Profil refuse: {error}', 'Profile denied: {error}'),
        'checkout_redirect' => t('Redirection Checkout {offer}...', 'Redirecting to Checkout {offer}...'),
        'checkout_denied' => t('Checkout refuse: {error}', 'Checkout denied: {error}'),
        'portal_redirect' => t('Redirection portail Stripe...', 'Redirecting to Stripe portal...'),
        'portal_denied' => t('Portail refuse: {error}', 'Portal denied: {error}'),
        'ticket_denied' => t('Ticket refuse: {error}', 'Ticket denied: {error}'),
        'reply_denied' => t('Reponse refusee: {error}', 'Reply denied: {error}'),
        'status_denied' => t('Statut refuse: {error}', 'Status denied: {error}'),
        'open_label' => t('Ouvrir', 'Open'),
        'view_label' => t('Voir', 'View'),
        'ticket_title' => t('Ticket', 'Ticket'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    page_response(t('Compte', 'Account'), '
      <section class="page-title">
        <p class="eyebrow">' . h(t('Espace client', 'Client area')) . '</p>
        <h1>' . h(t('Compte', 'Account')) . '</h1>
        <p>' . h(t('Profil, credits, abonnement, factures et support tickets.', 'Profile, credits, subscription, invoices, and support tickets.')) . '</p>
      </section>
      <section class="panel account-panel">
        <div class="stat"><span>' . h(t('Etat', 'Status')) . '</span><strong data-account-state>' . h(t('Non connecte', 'Signed out')) . '</strong></div>
        <div class="stat"><span>' . h(t('Courriel', 'Email')) . '</span><strong data-account-email>-</strong></div>
        <div class="stat"><span>' . h(t('Credits', 'Credits')) . '</span><strong data-account-credits>0</strong></div>
        <div class="stat"><span>' . h(t('Abonnement', 'Subscription')) . '</span><strong data-account-plan>' . h(t('Aucun', 'None')) . '</strong></div>
        <p data-account-message>' . h(t('Connecte-toi pour charger ton compte.', 'Sign in to load your account.')) . '</p>
      </section>
      <nav class="tab-nav" data-tab-nav role="tablist" aria-label="' . h(t('Sections compte', 'Account sections')) . '">
        <a role="tab" aria-selected="true" data-tab-target="account-profile" href="#account-profile">' . h(t('Profil', 'Profile')) . '</a>
        <a role="tab" aria-selected="false" data-tab-target="account-billing" href="#account-billing">' . h(t('Facturation', 'Billing')) . '</a>
        <a role="tab" aria-selected="false" data-tab-target="account-support" href="#account-support">' . h(t('Support', 'Support')) . '</a>
        <a role="tab" aria-selected="false" data-tab-target="account-app" href="#account-app">App</a>
      </nav>

      <section class="tab-panel" id="account-profile" data-tab-panel>
        <section class="panel">
          <h2>' . h(t('Profil', 'Profile')) . '</h2>
          <form class="client-form profile-form" data-profile-form>
            <label><span>' . h(t('Nom', 'Name')) . '</span><input name="display_name" type="text" maxlength="120"></label>
            <label><span>' . h(t('Courriel', 'Email')) . '</span><input name="email" type="email" required></label>
            <label><span>' . h(t('Nouveau mot de passe', 'New password')) . '</span><input name="password" type="password" minlength="8" maxlength="200" placeholder="' . h(t('laisser vide pour conserver', 'leave empty to keep current password')) . '"></label>
            <button type="submit">' . h(t('Enregistrer profil', 'Save profile')) . '</button>
          </form>
        </section>

        <section class="account-grid">
        <div class="panel">
          <h2>' . h(t('Connexion', 'Login')) . '</h2>
          <form class="client-form" data-login-form>
            <label><span>' . h(t('Courriel', 'Email')) . '</span><input name="email" type="email" value="demo@nichoir.local" autocomplete="username" required></label>
            <label><span>' . h(t('Mot de passe', 'Password')) . '</span><input name="password" type="password" value="password123" autocomplete="current-password" required></label>
            <div class="form-actions">
              <button type="submit">' . h(t('Connexion', 'Login')) . '</button>
              <button type="button" data-demo-login>Demo</button>
              <button type="button" data-logout>' . h(t('Sortir', 'Logout')) . '</button>
            </div>
          </form>
        </div>
        <div class="panel">
          <h2>' . h(t('Inscription dev', 'Dev registration')) . '</h2>
          <form class="client-form" data-register-form>
            <label><span>' . h(t('Nom', 'Name')) . '</span><input name="display_name" type="text" value="Demo" maxlength="120"></label>
            <label><span>' . h(t('Courriel', 'Email')) . '</span><input name="email" type="email" placeholder="client@example.com" required></label>
            <label><span>' . h(t('Mot de passe', 'Password')) . '</span><input name="password" type="password" minlength="8" maxlength="200" required></label>
            <button type="submit">' . h(t('Creer le compte', 'Create account')) . '</button>
          </form>
        </div>
        <div class="panel">
          <h2>' . h(t('Activation', 'Activation')) . '</h2>
          <form class="client-form" data-activation-form>
            <label><span>' . h(t('Courriel', 'Email')) . '</span><input name="email" type="email" placeholder="client@example.com" required></label>
            <label><span>' . h(t('Code', 'Code')) . '</span><input name="code" type="text" inputmode="numeric" minlength="6" maxlength="6" autocomplete="one-time-code" required></label>
            <div class="form-actions">
              <button type="submit">' . h(t('Activer', 'Activate')) . '</button>
              <button type="button" data-resend-activation>' . h(t('Renvoyer code', 'Resend code')) . '</button>
            </div>
          </form>
        </div>
      </section>
      </section>

      <section class="tab-panel" id="account-billing" data-tab-panel hidden>
        <section class="panel">
          <h2>' . h(t('Historique credits', 'Credit history')) . '</h2>
          <div class="table-wrap"><table><thead><tr><th>Delta</th><th>' . h(t('Raison', 'Reason')) . '</th><th>' . h(t('Reference', 'Reference')) . '</th><th>' . h(t('Date', 'Date')) . '</th></tr></thead><tbody data-ledger-rows><tr><td colspan="4">' . h(t('Non connecte.', 'Signed out.')) . '</td></tr></tbody></table></div>
        </section>

        <section class="account-grid">
        <div class="panel">
          <h2>' . h(t('Abonnement', 'Subscription')) . '</h2>
          <div class="client-summary compact">
            <div class="stat"><span>' . h(t('Plan', 'Plan')) . '</span><strong data-billing-plan>' . h(t('Aucun', 'None')) . '</strong></div>
            <div class="stat"><span>' . h(t('Etat', 'Status')) . '</span><strong data-billing-status>' . h(t('Aucun', 'None')) . '</strong></div>
            <div class="stat"><span>' . h(t('Fin periode', 'Period end')) . '</span><strong data-billing-period>-</strong></div>
          </div>
        </div>
        <div class="panel">
          <h2>Stripe</h2>
          <p>' . h(t('Checkout, portail client et factures sont generes cote serveur avec Stripe.', 'Checkout, customer portal, and invoices are generated server-side with Stripe.')) . '</p>
          <div class="form-actions billing-actions">
            <button type="button" data-billing-offer="credits">' . h(t('Credits', 'Credits')) . '</button>
            <button type="button" data-billing-offer="atelier">Atelier</button>
            <button type="button" data-billing-offer="pro">Pro</button>
            <button type="button" data-billing-portal>' . h(t('Portail Stripe', 'Stripe portal')) . '</button>
          </div>
          <p data-checkout-message></p>
        </div>
      </section>

        <section class="panel">
          <h2>' . h(t('Factures et paiements', 'Invoices and payments')) . '</h2>
          <div class="table-wrap"><table><thead><tr><th>ID</th><th>' . h(t('Montant', 'Amount')) . '</th><th>' . h(t('Etat', 'Status')) . '</th><th>' . h(t('Description', 'Description')) . '</th><th>' . h(t('Facture', 'Invoice')) . '</th><th>' . h(t('Date', 'Date')) . '</th></tr></thead><tbody data-payment-rows><tr><td colspan="6">' . h(t('Non connecte.', 'Signed out.')) . '</td></tr></tbody></table></div>
        </section>
      </section>

      <section class="tab-panel panel support-panel" id="account-support" data-tab-panel hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Support</p>
            <h2>' . h(t('Tickets', 'Tickets')) . '</h2>
          </div>
          <span class="section-hint">' . h(t('Creer, ouvrir le fil, repondre, fermer ou reouvrir.', 'Create, open the thread, reply, close, or reopen.')) . '</span>
        </div>
        <div class="support-layout">
          <form class="client-form ticket-form support-compose" data-ticket-form>
            <h3>' . h(t('Nouveau ticket', 'New ticket')) . '</h3>
            <label><span>' . h(t('Sujet', 'Subject')) . '</span><input name="subject" type="text" placeholder="' . h(t('Question sur un export', 'Question about an export')) . '" maxlength="140" required></label>
            <label><span>' . h(t('Message', 'Message')) . '</span><textarea name="body" rows="4" placeholder="' . h(t('Decris le probleme ou la demande', 'Describe the issue or request')) . '" maxlength="5000" required></textarea></label>
            <button type="submit">' . h(t('Envoyer ticket', 'Send ticket')) . '</button>
          </form>
          <div class="support-inbox">
            <h3>' . h(t('Mes demandes', 'My requests')) . '</h3>
            <div class="table-wrap"><table><thead><tr><th>ID</th><th>' . h(t('Sujet', 'Subject')) . '</th><th>' . h(t('Etat', 'Status')) . '</th><th>' . h(t('Priorite', 'Priority')) . '</th><th>' . h(t('MAJ', 'Updated')) . '</th><th></th></tr></thead><tbody data-ticket-rows><tr><td colspan="6">' . h(t('Non connecte.', 'Signed out.')) . '</td></tr></tbody></table></div>
            <div class="ticket-detail" data-ticket-detail hidden>
              <div class="ticket-detail-header">
                <div>
                  <h3 data-ticket-title>Ticket</h3>
                  <p data-ticket-meta></p>
                </div>
                <button type="button" data-ticket-toggle-status>' . h(t('Changer statut', 'Change status')) . '</button>
              </div>
              <div class="ticket-thread" data-ticket-thread></div>
              <form class="client-form ticket-form" data-ticket-reply-form>
                <label><span>' . h(t('Reponse', 'Reply')) . '</span><textarea name="body" rows="3" maxlength="5000" required></textarea></label>
                <button type="submit">' . h(t('Repondre au fil', 'Reply to thread')) . '</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section class="tab-panel grid" id="account-app" data-tab-panel hidden>
        <article><h2>App</h2><p>' . h(t('Les exports premium utilisent les credits visibles ici.', 'Premium exports use the credits shown here.')) . '</p></article>
        <article><h2>' . h(t('Serveur maitre', 'Source of truth')) . '</h2><p>' . h(t('Le compte, les credits, les abonnements, les paiements et les tickets viennent de PHP.', 'Account, credits, subscriptions, payments, and tickets come from PHP.')) . '</p></article>
        <article><h2>Stripe</h2><p>' . h(t('Le webhook remplira les paiements et mettra a jour l abonnement.', 'The webhook will populate payments and update the subscription.')) . '</p></article>
      </section>

      <script>
      const ACCOUNT_I18N = ' . $accountI18n . ';
      const TOKEN_KEY = "nichoir-auth-token";
      const demo = { email: "demo@nichoir.local", password: "password123" };
      let selectedTicketId = null;
      let selectedTicket = null;
      const token = () => localStorage.getItem(TOKEN_KEY);
      const setText = (selector, value) => document.querySelector(selector).textContent = value;
      const esc = (value) => String(value ?? "").replace(/[&<>"\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\x27": "&#39;" }[c]));
      const row = (cells) => `<tr>${cells.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`;
      const ti = (key, vars = {}) => {
        const template = ACCOUNT_I18N[key] || key;
        return Object.entries(vars).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
      };
      const accountStatusLabel = (value) => ({
        pending: ti("pending"),
        active: ti("active"),
        suspended: ti("suspended"),
        closed: ti("archived"),
      }[String(value || "").toLowerCase()] || String(value || "-"));
      const subscriptionLabel = (value) => ({
        none: ti("none"),
        active: ti("active"),
        canceled: ti("canceled"),
        cancelled: ti("cancelled"),
        past_due: ti("past_due"),
        unpaid: ti("unpaid"),
        trialing: ti("trialing"),
        incomplete: ti("incomplete"),
        suspended: ti("suspended"),
      }[String(value || "").toLowerCase()] || String(value || "-"));
      const planLabel = (value) => ({
        none: ti("none"),
        credits: ti("credits_plan"),
        atelier: ti("atelier_plan"),
        pro: ti("pro_plan"),
      }[String(value || "").toLowerCase()] || String(value || "-"));
      const ticketStatusLabel = (value) => ({
        open: ti("open_state"),
        closed: ti("closed_state"),
      }[String(value || "").toLowerCase()] || String(value || "-"));
      const paymentStatusLabel = (value) => ({
        pending: ti("pending"),
        paid: ti("paid"),
        succeeded: ti("succeeded"),
        failed: ti("failed"),
      }[String(value || "").toLowerCase()] || String(value || "-"));
      const ticketPriorityLabel = (value) => ({
        low: ti("low"),
        normal: ti("normal"),
        high: ti("high"),
        urgent: ti("urgent"),
      }[String(value || "").toLowerCase()] || String(value || "-"));

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
          activation_unavailable: ti("activation_unavailable"),
          activation_failed: ti("activation_failed"),
          too_many_requests: ti("too_many_requests"),
          invalid_credentials: ti("invalid_credentials"),
        };
        return labels[code] || code;
      }

      async function loadAccount() {
        const message = document.querySelector("[data-account-message]");
        if (!token()) {
          selectedTicketId = null;
          selectedTicket = null;
          setText("[data-account-state]", ti("signed_out"));
          setText("[data-account-email]", "-");
          setText("[data-account-credits]", "0");
          setText("[data-account-plan]", ti("none"));
          document.querySelector("[data-profile-form]").reset();
          setText("[data-billing-plan]", ti("none"));
          setText("[data-billing-status]", ti("none"));
          setText("[data-billing-period]", "-");
          document.querySelector("[data-ledger-rows]").innerHTML = `<tr><td colspan="4">${esc(ti("signed_out"))}.</td></tr>`;
          document.querySelector("[data-payment-rows]").innerHTML = `<tr><td colspan="6">${esc(ti("signed_out"))}.</td></tr>`;
          document.querySelector("[data-ticket-rows]").innerHTML = `<tr><td colspan="6">${esc(ti("signed_out"))}.</td></tr>`;
          renderTicketDetail(null);
          message.textContent = ti("connect_prompt");
          return;
        }
        try {
          const account = await api("/api/me");
          setText("[data-account-state]", accountStatusLabel(account.user.status || "active"));
          setText("[data-account-email]", account.user.email);
          setText("[data-account-credits]", account.user.credits);
          setText("[data-account-plan]", subscriptionLabel(account.user.subscription_status));
          document.querySelector("[data-profile-form] [name=display_name]").value = account.user.display_name || "";
          document.querySelector("[data-profile-form] [name=email]").value = account.user.email || "";
          const ledger = await api("/api/credits/ledger");
          document.querySelector("[data-ledger-rows]").innerHTML = ledger.ledger.length
            ? ledger.ledger.map((item) => row([item.delta, item.reason, item.reference || "-", item.created_at])).join("")
            : `<tr><td colspan="4">${esc(ti("no_ledger"))}</td></tr>`;
          const billing = await api("/api/billing/summary");
          setText("[data-billing-plan]", planLabel(billing.subscription.plan || "none"));
          setText("[data-billing-status]", subscriptionLabel(billing.subscription.status || "none"));
          setText("[data-billing-period]", billing.subscription.current_period_end || "-");
          document.querySelector("[data-payment-rows]").innerHTML = billing.payments.length
            ? billing.payments.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(`${(item.amount_cents / 100).toFixed(2)} ${String(item.currency).toUpperCase()}`)}</td><td>${esc(paymentStatusLabel(item.status))}</td><td>${esc(item.description || "-")}</td><td>${item.invoice_url ? `<a href="${esc(item.invoice_url)}" target="_blank" rel="noreferrer">${esc(ti("view_label"))}</a>` : "-"} ${item.invoice_pdf ? `<a href="${esc(item.invoice_pdf)}" target="_blank" rel="noreferrer">PDF</a>` : ""}</td><td>${esc(item.created_at)}</td></tr>`).join("")
            : `<tr><td colspan="6">${esc(ti("no_payment"))}</td></tr>`;
          const tickets = await api("/api/tickets");
          renderTicketRows(tickets.tickets || []);
          message.textContent = ti("account_loaded");
        } catch (err) {
          localStorage.removeItem(TOKEN_KEY);
          message.textContent = ti("invalid_session", { error: err.message || err });
          await loadAccount();
        }
      }

      function renderTicketRows(tickets) {
        document.querySelector("[data-ticket-rows]").innerHTML = tickets.length
          ? tickets.map((item) => `<tr${Number(item.id) === Number(selectedTicketId) ? ` class="selected-row"` : ``}><td>#${esc(item.id)}</td><td>${esc(item.subject)}</td><td>${esc(ticketStatusLabel(item.status))}</td><td>${esc(ticketPriorityLabel(item.priority || "normal"))}</td><td>${esc(item.updated_at || item.created_at)}</td><td><button type="button" data-open-ticket="${esc(item.id)}">${esc(ti("open_label"))}</button></td></tr>`).join("")
          : `<tr><td colspan="6">${esc(ti("no_ticket"))}</td></tr>`;
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
        document.querySelector("[data-ticket-meta]").textContent = `${ti("status_label")}: ${ticketStatusLabel(payload.ticket.status)} · ${ti("priority_label")}: ${ticketPriorityLabel(payload.ticket.priority || "normal")} · ${ti("updated_label")}: ${payload.ticket.updated_at}`;
        document.querySelector("[data-ticket-toggle-status]").textContent = payload.ticket.status === "open" ? ti("close") : ti("reopen");
        document.querySelector("[data-ticket-reply-form]").hidden = payload.ticket.status !== "open";
        document.querySelector("[data-ticket-thread]").innerHTML = (payload.messages || []).length
          ? payload.messages.map((message) => `<article class="ticket-message ${esc(message.author_role || "client")}"><header><strong>${message.author_role === "admin" ? esc(ti("support")) : esc(ti("client"))}</strong><span>${esc(message.created_at)}</span></header><p>${esc(message.body).replace(/\\n/g, "<br>")}</p></article>`).join("")
          : `<p>${esc(ti("no_message"))}</p>`;
      }

      async function loadTicketDetail(ticketId) {
        if (!ticketId || !token()) return;
        selectedTicketId = ticketId;
        try {
          renderTicketDetail(await api(`/api/tickets/${ticketId}`));
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = ti("ticket_not_found", { error: err.message || err });
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
          document.querySelector("[data-account-message]").textContent = ti("login_denied", { error: readableError(err) });
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
          document.querySelector("[data-account-message]").textContent = ti("register_notice");
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = ti("register_denied", { error: readableError(err) });
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
          document.querySelector("[data-account-message]").textContent = ti("account_activated");
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = ti("activation_denied", { error: readableError(err) });
        }
      });

      document.querySelector("[data-resend-activation]").addEventListener("click", async () => {
        const email = document.querySelector("[data-activation-form] [name=email]").value || document.querySelector("[data-register-form] [name=email]").value;
        try {
          await api("/api/auth/resend-activation", {
            method: "POST",
            body: JSON.stringify({ email }),
          });
          document.querySelector("[data-account-message]").textContent = ti("resend_notice");
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = ti("resend_denied", { error: readableError(err) });
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
          document.querySelector("[data-account-message]").textContent = ti("profile_saved");
          await loadAccount();
        } catch (err) {
          document.querySelector("[data-account-message]").textContent = ti("profile_denied", { error: err.message || err });
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
          document.querySelector("[data-checkout-message]").textContent = ti("checkout_redirect", { offer: payload.offer });
          window.location.href = payload.checkout_url;
        } catch (err) {
          document.querySelector("[data-checkout-message]").textContent = ti("checkout_denied", { error: err.message || err });
        }
      });
      });
      document.querySelector("[data-billing-portal]").addEventListener("click", async () => {
        try {
          const payload = await api("/api/billing/portal", { method: "POST" });
          document.querySelector("[data-checkout-message]").textContent = ti("portal_redirect");
          window.location.href = payload.portal_url;
        } catch (err) {
          document.querySelector("[data-checkout-message]").textContent = ti("portal_denied", { error: err.message || err });
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
          document.querySelector("[data-account-message]").textContent = ti("ticket_denied", { error: err.message || err });
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
          document.querySelector("[data-account-message]").textContent = ti("reply_denied", { error: err.message || err });
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
          document.querySelector("[data-account-message]").textContent = ti("status_denied", { error: err.message || err });
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

function admin_current_query_params(): array
{
    $params = $_GET;
    unset($params['']);
    return $params;
}

function admin_query_context(array $keys): array
{
    $all = admin_current_query_params();
    $params = [];
    foreach ($keys as $key) {
        $name = (string) $key;
        if (!array_key_exists($name, $all) || is_array($all[$name])) {
            continue;
        }
        $params[$name] = (string) $all[$name];
    }
    return $params;
}

function admin_current_url(array $overrides = [], string $hash = '', array $remove = []): string
{
    $params = admin_current_query_params();
    foreach ($remove as $key) {
        unset($params[$key]);
    }
    foreach ($overrides as $key => $value) {
        if ($value === null || $value === '') {
            unset($params[$key]);
        } else {
            $params[$key] = (string) $value;
        }
    }
    return admin_redirect_url($params) . $hash;
}

function admin_hidden_query_inputs(array $exclude = [], array $include = []): string
{
    $html = '';
    $params = $include === [] ? admin_current_query_params() : admin_query_context($include);
    foreach ($params as $key => $value) {
        if (in_array((string) $key, $exclude, true)) {
            continue;
        }
        if (is_array($value)) {
            continue;
        }
        $html .= '<input type="hidden" name="' . h((string) $key) . '" value="' . h((string) $value) . '">';
    }
    return $html;
}

function admin_table_rows_value(string $value, int $default = 10): int
{
    $value = strtolower(trim($value));
    if ($value === 'all') {
        return 0;
    }
    $allowed = [10, 25, 50, 100];
    $intValue = (int) $value;
    return in_array($intValue, $allowed, true) ? $intValue : $default;
}

function admin_table_state(string $tableKey, array $sortableFields, string $defaultSort, string $defaultDir = 'desc', int $defaultRows = 10): array
{
    $allowedFields = array_keys($sortableFields);
    $sort = trim((string) ($_GET[$tableKey . '_sort'] ?? $defaultSort));
    if (!in_array($sort, $allowedFields, true)) {
        $sort = $defaultSort;
    }
    $dir = strtolower(trim((string) ($_GET[$tableKey . '_dir'] ?? $defaultDir)));
    if (!in_array($dir, ['asc', 'desc'], true)) {
        $dir = $defaultDir;
    }
    $rows = admin_table_rows_value((string) ($_GET[$tableKey . '_rows'] ?? (string) $defaultRows), $defaultRows);
    return [
        'key' => $tableKey,
        'sort' => $sort,
        'dir' => $dir,
        'rows' => $rows,
        'rows_param' => $rows === 0 ? 'all' : (string) $rows,
    ];
}

function admin_table_sort_indicator(array $state, string $field): string
{
    if ($state['sort'] !== $field) {
        return '<span class="sort-indicator">↕</span>';
    }
    return '<span class="sort-indicator active">' . ($state['dir'] === 'asc' ? '↑' : '↓') . '</span>';
}

function admin_table_header_link(string $label, string $tableKey, string $field, array $state, string $hash): string
{
    return admin_table_header_link_with_context($label, $tableKey, $field, $state, $hash, []);
}

function admin_table_header_link_with_context(string $label, string $tableKey, string $field, array $state, string $hash, array $contextKeys): string
{
    $nextDir = ($state['sort'] === $field && $state['dir'] === 'asc') ? 'desc' : 'asc';
    $href = admin_redirect_url(array_merge(admin_query_context($contextKeys), [
        $tableKey . '_sort' => $field,
        $tableKey . '_dir' => $nextDir,
    ])) . $hash;
    $class = $state['sort'] === $field ? ' class="sort-link active"' : ' class="sort-link"';
    return '<a' . $class . ' href="' . h($href) . '">' . h($label) . admin_table_sort_indicator($state, $field) . '</a>';
}

function admin_table_controls(string $tableKey, array $state, string $hash, int $totalRows, string $label = 'Lignes'): string
{
    return admin_table_controls_with_context($tableKey, $state, $hash, $totalRows, $label, []);
}

function admin_table_controls_with_context(string $tableKey, array $state, string $hash, int $totalRows, string $label = 'Lignes', array $contextKeys = []): string
{
    $options = '';
    foreach ([10, 25, 50, 100] as $option) {
        $options .= '<option value="' . $option . '"' . ($state['rows'] === $option ? ' selected' : '') . '>' . $option . '</option>';
    }
    $options .= '<option value="all"' . ($state['rows'] === 0 ? ' selected' : '') . '>' . h(t('Toutes', 'All')) . '</option>';
    return '
      <div class="table-toolbar">
        <div class="table-count">' . $totalRows . ' ' . h($label) . '</div>
        <form class="table-rows-form" method="get" action="/admin' . h($hash) . '">
          ' . admin_hidden_query_inputs([$tableKey . '_rows'], $contextKeys) . '
          <label><span>' . h(t('Afficher', 'Show')) . '</span><select name="' . h($tableKey . '_rows') . '" data-auto-submit-select>' . $options . '</select></label>
        </form>
      </div>
    ';
}

function admin_sort_value_for_row(array $row, string $field, mixed $config): mixed
{
    if (is_array($config) && isset($config['value']) && is_callable($config['value'])) {
        return $config['value']($row);
    }
    return $row[$field] ?? null;
}

function admin_normalize_sort_value(mixed $value, string $type): mixed
{
    return match ($type) {
        'int' => (int) $value,
        'float' => (float) $value,
        'bool' => $value ? 1 : 0,
        'date' => (string) ($value ?? ''),
        default => strtolower(trim((string) ($value ?? ''))),
    };
}

function admin_apply_table_state(array $rows, array $state, array $sortableFields): array
{
    $field = (string) $state['sort'];
    $config = $sortableFields[$field] ?? 'string';
    $type = is_array($config) ? (string) ($config['type'] ?? 'string') : (string) $config;
    usort($rows, static function (array $left, array $right) use ($field, $config, $type, $state): int {
        $leftValue = admin_normalize_sort_value(admin_sort_value_for_row($left, $field, $config), $type);
        $rightValue = admin_normalize_sort_value(admin_sort_value_for_row($right, $field, $config), $type);
        $result = $leftValue <=> $rightValue;
        if ($result === 0) {
            $leftId = (int) ($left['id'] ?? 0);
            $rightId = (int) ($right['id'] ?? 0);
            $result = $leftId <=> $rightId;
        }
        return $state['dir'] === 'asc' ? $result : -$result;
    });
    if ((int) $state['rows'] > 0) {
        return array_slice($rows, 0, (int) $state['rows']);
    }
    return $rows;
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

function admin_billing_view_value(string $value, string $scope = 'all'): string
{
    $allowed = $scope === 'payments'
        ? ['payments']
        : ($scope === 'subscriptions' ? ['subscriptions'] : ['subscriptions', 'payments']);
    $fallback = $scope === 'payments' ? 'payments' : 'subscriptions';
    return in_array($value, $allowed, true) ? $value : $fallback;
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
    $filters['billing_view'] = admin_billing_view_value((string) ($filters['billing_view'] ?? ''), $scope);
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
    $scope = admin_billing_scope_value((string) ($_GET['billing_scope'] ?? 'all'));
    return admin_normalize_billing_filters([
        'billing_scope' => $scope,
        'billing_view' => admin_billing_view_value((string) ($_GET['billing_view'] ?? ''), $scope),
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

function admin_billing_content_nav(array $filters, int $subscriptionCount, int $paymentCount): string
{
    if ((string) ($filters['billing_scope'] ?? 'all') !== 'all') {
        return '';
    }
    $current = (string) ($filters['billing_view'] ?? 'subscriptions');
    $items = [
        'subscriptions' => [t('Abonnements', 'Subscriptions'), $subscriptionCount],
        'payments' => [t('Paiements', 'Payments'), $paymentCount],
    ];
    $links = '';
    foreach ($items as $view => [$label, $count]) {
        $classAttr = $current === $view ? ' class="active"' : '';
        $links .= '<a' . $classAttr . ' href="' . h(admin_billing_filter_url(['billing_view' => $view])) . '"><span>' . h($label) . '</span><strong>' . (int) $count . '</strong></a>';
    }
    return '<nav class="tab-nav billing-detail-nav" aria-label="' . h(t('Detail billing', 'Billing detail')) . '">' . $links . '</nav>';
}

function admin_select_options(array $values, string $selected, string $emptyLabel = ''): string
{
    if ($emptyLabel === '') {
        $emptyLabel = t('Tous', 'All');
    }
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

function admin_user_status_label(string $status): string
{
    $normalized = strtolower(trim($status));
    return match ($normalized) {
        'pending' => t('En attente', 'Pending'),
        'active' => t('Actif', 'Active'),
        'suspended' => t('Suspendu', 'Suspended'),
        'closed' => t('Archive', 'Archived'),
        default => admin_code_label($status),
    };
}

function admin_user_status_tone(string $status): string
{
    return match (strtolower(trim($status))) {
        'active' => 'success',
        'pending', 'suspended' => 'warning',
        'closed' => 'neutral',
        default => 'neutral',
    };
}

function admin_plan_label(string $plan): string
{
    return match (strtolower(trim($plan))) {
        'none' => t('Aucun', 'None'),
        'credits' => t('Credits', 'Credits'),
        'atelier' => 'Atelier',
        'pro' => 'Pro',
        default => admin_code_label($plan),
    };
}

function admin_subscription_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'active' => t('Actif', 'Active'),
        'trialing' => t('Essai', 'Trial'),
        'past_due' => t('En retard', 'Past due'),
        'incomplete' => t('Incomplet', 'Incomplete'),
        'canceled', 'cancelled' => t('Annule', 'Canceled'),
        'unpaid' => t('Impaye', 'Unpaid'),
        'none' => t('Aucun', 'None'),
        default => admin_code_label($status),
    };
}

function admin_subscription_status_tone(string $status): string
{
    return match (strtolower(trim($status))) {
        'active', 'trialing' => 'success',
        'past_due', 'incomplete' => 'warning',
        'canceled', 'cancelled', 'unpaid' => 'danger',
        'none' => 'neutral',
        default => 'neutral',
    };
}

function admin_payment_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'paid', 'succeeded' => t('Paye', 'Paid'),
        'pending' => t('En attente', 'Pending'),
        'processing' => t('En traitement', 'Processing'),
        'requires_action' => t('Action requise', 'Action required'),
        'failed' => t('Echec', 'Failed'),
        'canceled', 'cancelled' => t('Annule', 'Canceled'),
        default => admin_code_label($status),
    };
}

function admin_payment_status_tone(string $status): string
{
    return match (strtolower(trim($status))) {
        'paid', 'succeeded' => 'success',
        'pending', 'processing', 'requires_action' => 'warning',
        'failed', 'canceled', 'cancelled' => 'danger',
        default => 'neutral',
    };
}

function admin_provider_label(string $provider): string
{
    return match (strtolower(trim($provider))) {
        'stripe' => 'Stripe',
        default => admin_code_label($provider),
    };
}

function admin_smtp_encryption_label(string $mode): string
{
    return match (strtolower(trim($mode))) {
        'none' => t('Sans chiffrement', 'No encryption'),
        'tls' => 'TLS',
        'ssl' => 'SSL',
        default => admin_code_label($mode),
    };
}

function admin_notification_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'sent' => t('Envoye', 'Sent'),
        'failed' => t('Echec', 'Failed'),
        'pending', 'queued' => t('En attente', 'Pending'),
        'skipped' => t('Ignore', 'Skipped'),
        'smtp_disabled' => t('SMTP inactif', 'SMTP disabled'),
        default => admin_code_label($status),
    };
}

function admin_notification_status_tone(string $status): string
{
    return match (strtolower(trim($status))) {
        'sent' => 'success',
        'pending', 'queued' => 'warning',
        'failed' => 'danger',
        'skipped', 'smtp_disabled' => 'neutral',
        default => 'neutral',
    };
}

function admin_notification_error_label(string $error): string
{
    return match (strtolower(trim($error))) {
        '' => '-',
        'smtp_disabled' => t('SMTP inactif', 'SMTP disabled'),
        'smtp_demo_failure' => t('Echec du test SMTP', 'SMTP test failed'),
        default => admin_code_label($error),
    };
}

function admin_export_type_label(string $type): string
{
    return match (strtolower(trim($type))) {
        'stl' => t('Modele STL', 'STL model'),
        'zip' => t('Archive ZIP', 'ZIP archive'),
        'pdf' => t('Plan PDF', 'PDF plan'),
        'svg' => t('Vectoriel SVG', 'SVG vector'),
        'png' => t('Image PNG', 'PNG image'),
        default => admin_code_label($type),
    };
}

function admin_log_channel_label(string $channel): string
{
    return match (strtolower(trim($channel))) {
        'auth' => t('Authentification', 'Authentication'),
        'admin' => t('Administration', 'Administration'),
        'api' => 'API',
        'email' => t('Email', 'Email'),
        'stripe' => 'Stripe',
        'wasm' => 'WASM',
        'cron' => 'Cron',
        'browser' => t('Navigateur', 'Browser'),
        'support' => 'Support',
        default => admin_code_label($channel),
    };
}

function admin_log_level_label(string $level): string
{
    return match (strtolower(trim($level))) {
        'debug' => 'Debug',
        'info' => 'Info',
        'warning' => t('Alerte', 'Warning'),
        'error' => t('Erreur', 'Error'),
        'critical' => t('Critique', 'Critical'),
        'security' => t('Securite', 'Security'),
        default => admin_code_label($level),
    };
}

function admin_actor_role_label(string $role): string
{
    return match (strtolower(trim($role))) {
        'admin' => 'Admin',
        'client', 'user' => t('Client', 'Client'),
        'system' => t('Systeme', 'System'),
        'cron' => 'Cron',
        default => admin_code_label($role),
    };
}

function admin_target_type_label(string $type): string
{
    return match (strtolower(trim($type))) {
        'user' => t('Client', 'Client'),
        'ticket' => t('Ticket', 'Ticket'),
        'ticket_message' => t('Message ticket', 'Ticket message'),
        'ticket_notification' => t('Notification ticket', 'Ticket notification'),
        'subscription' => t('Abonnement', 'Subscription'),
        'payment' => t('Paiement', 'Payment'),
        'export_authorization' => t('Autorisation export', 'Export authorization'),
        'email_settings' => t('Reglages email', 'Email settings'),
        'stripe_settings' => t('Reglages Stripe', 'Stripe settings'),
        'database_settings' => t('Reglages base de donnees', 'Database settings'),
        default => admin_code_label($type),
    };
}

function admin_log_event_label(string $event): string
{
    return match (strtolower(trim($event))) {
        'login_success' => t('Connexion reussie', 'Login successful'),
        'login_failed' => t('Echec de connexion', 'Login failed'),
        'export_authorized' => t('Export autorise', 'Export authorized'),
        'export_consumed' => t('Export consomme', 'Export consumed'),
        'rate_limit_triggered' => t('Limite atteinte', 'Rate limit reached'),
        'admin_access_denied' => t('Acces admin refuse', 'Admin access denied'),
        'email_failed' => t('Envoi email echoue', 'Email send failed'),
        'php_error' => t('Erreur PHP', 'PHP error'),
        'permission_denied' => t('Permission refusee', 'Permission denied'),
        'csrf_failed' => t('Controle CSRF refuse', 'CSRF check failed'),
        'invalid_token' => t('Jeton invalide', 'Invalid token'),
        'email_sent' => t('Email envoye', 'Email sent'),
        'ticket_created' => t('Ticket cree', 'Ticket created'),
        'ticket_replied' => t('Reponse ticket', 'Ticket reply'),
        'ticket_status_changed' => t('Statut ticket modifie', 'Ticket status changed'),
        default => admin_code_label($event),
    };
}

function admin_audit_action_label(string $action): string
{
    return match (strtolower(trim($action))) {
        'admin_user_updated' => t('Profil client modifie', 'Client profile updated'),
        'admin_user_suspended' => t('Client suspendu', 'Client suspended'),
        'admin_settings_changed' => t('Reglages modifies', 'Settings updated'),
        'send_test_email_failed' => t('Test email echoue', 'Email test failed'),
        'export_consumed' => t('Export consomme', 'Export consumed'),
        'login_success' => t('Connexion reussie', 'Login successful'),
        default => admin_log_event_label($action),
    };
}

function admin_stripe_event_label(string $eventType): string
{
    return match (strtolower(trim($eventType))) {
        'checkout.session.completed' => t('Checkout termine', 'Checkout completed'),
        'invoice.paid' => t('Facture payee', 'Invoice paid'),
        'invoice.payment_failed' => t('Paiement facture echoue', 'Invoice payment failed'),
        'customer.subscription.created' => t('Abonnement cree', 'Subscription created'),
        'customer.subscription.updated' => t('Abonnement mis a jour', 'Subscription updated'),
        'customer.subscription.deleted' => t('Abonnement supprime', 'Subscription deleted'),
        default => ucwords(str_replace(['.', '_'], ' ', strtolower(trim($eventType)))),
    };
}

function admin_table_stack(string $primary, string $secondary = '', bool $secondaryIsCode = false): string
{
    $secondaryHtml = '';
    if (trim($secondary) !== '') {
        $secondaryContent = $secondaryIsCode ? '<code>' . h($secondary) . '</code>' : h($secondary);
        $secondaryHtml = '<span class="table-subtle">' . $secondaryContent . '</span>';
    }
    return '<div class="table-stack"><strong>' . h($primary) . '</strong>' . $secondaryHtml . '</div>';
}

function admin_ticket_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'open' => t('Ouvert', 'Open'),
        'closed' => t('Ferme', 'Closed'),
        default => admin_code_label($status),
    };
}

function admin_ticket_status_tone(string $status): string
{
    return match (strtolower(trim($status))) {
        'open' => 'warning',
        'closed' => 'neutral',
        default => 'neutral',
    };
}

function admin_ticket_priority_label(string $priority): string
{
    return match (strtolower(trim($priority))) {
        'low' => t('Basse', 'Low'),
        'normal' => t('Normale', 'Normal'),
        'high' => t('Haute', 'High'),
        'urgent' => t('Urgente', 'Urgent'),
        default => admin_code_label($priority),
    };
}

function admin_ticket_priority_tone(string $priority): string
{
    return match (strtolower(trim($priority))) {
        'high' => 'warning',
        'urgent' => 'danger',
        'low' => 'neutral',
        default => 'info',
    };
}

function admin_audit_outcome_label(string $outcome): string
{
    return match (strtolower(trim($outcome))) {
        'success' => t('Succes', 'Success'),
        'failed' => t('Echec', 'Failed'),
        'blocked' => t('Bloque', 'Blocked'),
        default => admin_code_label($outcome),
    };
}

function admin_stripe_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'received' => t('Recu', 'Received'),
        'processing' => t('En traitement', 'Processing'),
        'processed' => t('Traite', 'Processed'),
        'failed' => t('Echec', 'Failed'),
        'ignored' => t('Ignore', 'Ignored'),
        default => admin_code_label($status),
    };
}

function admin_billing_scope_nav(array $filters, int $subscriptionCount, int $paymentCount): string
{
    $current = (string) ($filters['billing_scope'] ?? 'all');
    $items = [
        'all' => [t('Tout', 'All'), $subscriptionCount + $paymentCount],
        'subscriptions' => [t('Abonnements', 'Subscriptions'), $subscriptionCount],
        'payments' => [t('Paiements', 'Payments'), $paymentCount],
    ];
    $links = '';
    foreach ($items as $scope => [$label, $count]) {
        $class = 'log-scope-link' . ($current === $scope ? ' active' : '');
        $links .= '<a class="' . $class . '" href="' . h(admin_billing_filter_url(['billing_scope' => $scope])) . '"><span>' . h($label) . '</span><strong>' . (int) $count . '</strong></a>';
    }
    return '<nav class="log-scope-nav" aria-label="' . h(t('Portee billing', 'Billing scope')) . '">' . $links . '</nav>';
}

function admin_billing_filter_summary(array $filters): string
{
    $chips = [];
    $scope = (string) ($filters['billing_scope'] ?? 'all');
    $map = [
        'billing_q' => [t('Recherche', 'Search'), static fn (string $value): string => $value],
        'billing_provider' => ['Provider', 'admin_provider_label'],
        'billing_date_from' => [t('Depuis', 'From'), static fn (string $value): string => $value],
        'billing_date_to' => [t('Jusqu a', 'To'), static fn (string $value): string => $value],
    ];
    if ($scope !== 'payments') {
        $map['billing_plan'] = [t('Plan', 'Plan'), 'admin_plan_label'];
        $map['billing_subscription_status'] = [t('Etat abo', 'Subscription status'), 'admin_subscription_status_label'];
    }
    if ($scope !== 'subscriptions') {
        $map['billing_payment_status'] = [t('Etat paiement', 'Payment status'), 'admin_payment_status_label'];
        $map['billing_currency'] = [t('Devise', 'Currency'), 'strtoupper'];
        $map['billing_invoice'] = [t('Facture', 'Invoice'), static fn (string $value): string => $value === 'yes' ? t('Avec facture', 'With invoice') : t('Sans facture', 'Without invoice')];
        $map['billing_amount_min'] = [t('Min', 'Min'), static fn (string $value): string => $value];
        $map['billing_amount_max'] = [t('Max', 'Max'), static fn (string $value): string => $value];
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
        return '<p class="section-hint">' . h(t('Vue standard du billing. Utilise la recherche, la periode et les statuts pour isoler un cas avant d ouvrir le detail client.', 'Default billing view. Use search, date range, and statuses to isolate a case before opening client details.')) . '</p>';
    }
    return '<ul class="filter-chip-list" aria-label="' . h(t('Filtres billing actifs', 'Active billing filters')) . '">' . implode('', $chips) . '</ul>';
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
    foreach (array_keys(ADMIN_USER_STATUSES) as $value) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h(admin_user_status_label($value)) . '</option>';
    }
    return $html;
}

function admin_plan_options(string $current): string
{
    $html = '';
    foreach (ADMIN_PLANS as $option) {
        $selected = $current === $option ? ' selected' : '';
        $html .= '<option value="' . h($option) . '"' . $selected . '>' . h(admin_plan_label($option)) . '</option>';
    }
    return $html;
}

function admin_subscription_status_options(string $current): string
{
    $html = '';
    foreach (ADMIN_SUBSCRIPTION_STATUSES as $option) {
        $selected = $current === $option ? ' selected' : '';
        $html .= '<option value="' . h($option) . '"' . $selected . '>' . h(admin_subscription_status_label($option)) . '</option>';
    }
    return $html;
}

function ticket_status_options(string $current): string
{
    $html = '';
    foreach (array_keys(TICKET_STATUSES) as $value) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h(admin_ticket_status_label($value)) . '</option>';
    }
    return $html;
}

function ticket_priority_options(string $current): string
{
    $html = '';
    foreach (array_keys(TICKET_PRIORITIES) as $value) {
        $selected = $current === $value ? ' selected' : '';
        $html .= '<option value="' . h($value) . '"' . $selected . '>' . h(admin_ticket_priority_label($value)) . '</option>';
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
        page_response('Admin', '<section class="page-title"><h1>' . h(t('Admin protege', 'Protected admin')) . '</h1><p>' . h(t('Acces refuse.', 'Access denied.')) . '</p></section>', '/admin', 403);
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
        <h2>' . h(t('Creer utilisateur', 'Create user')) . '</h2>
        <form class="admin-create-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="create_user">
          <label><span>' . h(t('Courriel', 'Email')) . '</span><input type="email" name="email" required></label>
          <label><span>' . h(t('Nom', 'Name')) . '</span><input type="text" name="display_name"></label>
          <label><span>' . h(t('Mot de passe initial', 'Initial password')) . '</span><input type="password" name="password" minlength="8" required></label>
          <label><span>' . h(t('Credits initiaux', 'Initial credits')) . '</span><input type="number" name="credits" min="0" step="1" value="0"></label>
          <label><span>' . h(t('Statut', 'Status')) . '</span><select name="status">' . admin_status_options('active') . '</select></label>
          <button type="submit">' . h(t('Creer', 'Create')) . '</button>
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
    $contextKeys = ['key', 'q', 'status', 'subscription_status'];
    $query = strtolower(trim((string) ($_GET['q'] ?? '')));
    $status = trim((string) ($_GET['status'] ?? ''));
    $subscriptionStatus = trim((string) ($_GET['subscription_status'] ?? ''));
    $where = [];
    $params = [];
    $tableState = admin_table_state('clients_table', [
        'id' => 'int',
        'email' => 'string',
        'display_name' => 'string',
        'credits' => 'int',
        'subscription_status' => 'string',
        'status' => 'string',
        'created_at' => 'date',
    ], 'id');

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

    $metricsStmt = $pdo->prepare('SELECT status, COUNT(*) AS total FROM users ' . $whereSql . ' GROUP BY status');
    $metricsStmt->execute($params);
    $statusCounts = [
        'active' => 0,
        'pending' => 0,
        'suspended' => 0,
        'closed' => 0,
    ];
    foreach ($metricsStmt->fetchAll() as $metricRow) {
        $statusKey = strtolower(trim((string) ($metricRow['status'] ?? '')));
        if (array_key_exists($statusKey, $statusCounts)) {
            $statusCounts[$statusKey] = (int) $metricRow['total'];
        }
    }

    $stmt = $pdo->prepare('SELECT id, email, display_name, credits, subscription_status, status, created_at FROM users ' . $whereSql);
    $stmt->execute($params);

    $items = $stmt->fetchAll();
    $items = admin_apply_table_state($items, $tableState, [
        'id' => 'int',
        'email' => 'string',
        'display_name' => 'string',
        'credits' => 'int',
        'subscription_status' => 'string',
        'status' => 'string',
        'created_at' => 'date',
    ]);
    $rows = '';
    foreach ($items as $user) {
        $href = admin_client_modal_url((int) $user['id'], 'admin-clients', 'profile');
        $subscriptionState = (string) ($user['subscription_status'] ?? 'none');
        $userState = (string) ($user['status'] ?? 'active');
        $rows .= '<tr><td><a href="' . h($href) . '">' . (int) $user['id'] . '</a></td><td><a href="' . h($href) . '">' . h((string) $user['email']) . '</a></td><td>' . h((string) ($user['display_name'] ?: '-')) . '</td><td>' . (int) $user['credits'] . '</td><td>' . admin_log_badge(admin_subscription_status_tone($subscriptionState), admin_subscription_status_label($subscriptionState)) . '</td><td>' . admin_log_badge(admin_user_status_tone($userState), admin_user_status_label($userState)) . '</td><td>' . h((string) $user['created_at']) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="7">' . h(t('Aucun utilisateur trouve.', 'No user found.')) . '</td></tr>';

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>' . h(t('Repertoire utilisateurs', 'User directory')) . '</h2>
            <p>' . h(t('Le clic sur l ID ou le courriel ouvre directement la fiche client en fenetre modale.', 'Click the ID or email to open the client record directly in a modal.')) . '</p>
          </div>
          <div>' . admin_log_badge('neutral', (string) $total) . '</div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>' . h(t('Filtres', 'Filtered')) . '</span><strong>' . $total . '</strong></div>
          <div class="stat"><span>' . h(t('Actifs', 'Active')) . '</span><strong>' . $statusCounts['active'] . '</strong></div>
          <div class="stat"><span>' . h(t('Suspendus', 'Suspended')) . '</span><strong>' . $statusCounts['suspended'] . '</strong></div>
          <div class="stat"><span>' . h(t('Archives', 'Archived')) . '</span><strong>' . $statusCounts['closed'] . '</strong></div>
        </div>
        <form class="admin-directory-form" method="get" action="/admin">
          ' . admin_key_input() . '
          <label><span>' . h(t('Recherche', 'Search')) . '</span><input type="search" name="q" value="' . h((string) ($_GET['q'] ?? '')) . '" placeholder="' . h(t('id, courriel ou nom', 'id, email, or name')) . '"></label>
          <label><span>' . h(t('Statut', 'Status')) . '</span><select name="status"><option value="">' . h(t('Tous', 'All')) . '</option>' . admin_status_options($status) . '</select></label>
          <label><span>' . h(t('Abonnement', 'Subscription')) . '</span><select name="subscription_status"><option value="">' . h(t('Tous', 'All')) . '</option>' . admin_subscription_status_options($subscriptionStatus) . '</select></label>
          <button type="submit">' . h(t('Filtrer', 'Filter')) . '</button>
        </form>
        ' . admin_table_controls_with_context('clients_table', $tableState, '#admin-clients', $total, t('clients', 'clients'), $contextKeys) . '
        <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context('ID', 'clients_table', 'id', $tableState, '#admin-clients', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Courriel', 'Email'), 'clients_table', 'email', $tableState, '#admin-clients', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Nom', 'Name'), 'clients_table', 'display_name', $tableState, '#admin-clients', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Credits', 'Credits'), 'clients_table', 'credits', $tableState, '#admin-clients', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Abonnement', 'Subscription'), 'clients_table', 'subscription_status', $tableState, '#admin-clients', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Statut', 'Status'), 'clients_table', 'status', $tableState, '#admin-clients', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Cree', 'Created'), 'clients_table', 'created_at', $tableState, '#admin-clients', $contextKeys) . '</th></tr></thead><tbody>' . $rows . '</tbody></table></div>
      </section>
    ';
}

function render_open_tickets_panel(PDO $pdo): string
{
    $contextKeys = ['key'];
    $tableState = admin_table_state('support_table', [
        'id' => 'int',
        'email' => 'string',
        'subject' => 'string',
        'priority' => 'string',
        'updated_at' => 'date',
    ], 'updated_at');
    $stmt = $pdo->query(
        'SELECT tickets.id, tickets.user_id, tickets.subject, tickets.priority, tickets.updated_at, users.email
         FROM tickets
         JOIN users ON users.id = tickets.user_id
         WHERE tickets.status = "open"'
    );
    $allTickets = $stmt->fetchAll();
    $tickets = admin_apply_table_state($allTickets, $tableState, [
        'id' => 'int',
        'email' => 'string',
        'subject' => 'string',
        'priority' => 'string',
        'updated_at' => 'date',
    ]);
    $rows = '';
    foreach ($tickets as $ticket) {
        $href = admin_redirect_url(['ticket_id' => (int) $ticket['id']]) . '#admin-support';
        $clientHref = admin_client_modal_url((int) $ticket['user_id'], 'admin-support', 'profile');
        $priority = (string) ($ticket['priority'] ?? 'normal');
        $rows .= '<tr><td><a href="' . h($href) . '">#' . (int) $ticket['id'] . '</a></td><td><a href="' . h($clientHref) . '">' . h((string) $ticket['email']) . '</a></td><td>' . h((string) $ticket['subject']) . '</td><td>' . admin_log_badge(admin_ticket_priority_tone($priority), admin_ticket_priority_label($priority)) . '</td><td>' . h((string) $ticket['updated_at']) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="5">' . h(t('Aucun ticket ouvert.', 'No open ticket.')) . '</td></tr>';

    return '
      <section class="panel" id="support-queue">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Support</p>
            <h2>' . h(t('Tickets ouverts', 'Open tickets')) . '</h2>
          </div>
          <span class="section-hint">' . h(t('Clique sur l identifiant du ticket pour ouvrir le fil complet et repondre au client.', 'Click the ticket ID to open the full thread and reply to the client.')) . '</span>
        </div>
        ' . admin_table_controls_with_context('support_table', $tableState, '#admin-support', count($allTickets), t('tickets', 'tickets'), $contextKeys) . '
        <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context('ID', 'support_table', 'id', $tableState, '#admin-support', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Client', 'Client'), 'support_table', 'email', $tableState, '#admin-support', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Sujet', 'Subject'), 'support_table', 'subject', $tableState, '#admin-support', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Priorite', 'Priority'), 'support_table', 'priority', $tableState, '#admin-support', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('MAJ', 'Updated'), 'support_table', 'updated_at', $tableState, '#admin-support', $contextKeys) . '</th></tr></thead><tbody>' . $rows . '</tbody></table></div>
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
        return '<section class="panel"><h2>' . h(t('Fiche client', 'Client record')) . '</h2><p>' . h(t('Selectionne un client dans le repertoire.', 'Select a client in the directory.')) . '</p></section>';
    }

    $userId = (int) $user['id'];
    $status = (string) ($user['status'] ?? 'active');
    $deletedAt = (string) ($user['deleted_at'] ?? '');
    $nextStatus = $status === 'active' ? 'suspended' : 'active';
    $nextLabel = $nextStatus === 'active' ? t('Reactiver', 'Reactivate') : t('Suspendre', 'Suspend');

    return '
      <section class="panel client-detail">
        <h2>' . h(t('Fiche client', 'Client record')) . '</h2>
        <div class="client-summary">
          <div class="stat"><span>ID</span><strong>' . $userId . '</strong></div>
          <div class="stat"><span>' . h(t('Courriel', 'Email')) . '</span><strong>' . h((string) $user['email']) . '</strong></div>
          <div class="stat"><span>' . h(t('Credits', 'Credits')) . '</span><strong>' . (int) $user['credits'] . '</strong></div>
          <div class="stat"><span>' . h(t('Statut', 'Status')) . '</span>' . admin_log_badge(admin_user_status_tone($status), admin_user_status_label($status)) . '</div>
          ' . ($deletedAt !== '' ? '<div class="stat"><span>' . h(t('Archive le', 'Archived on')) . '</span><strong>' . h($deletedAt) . '</strong></div>' : '') . '
        </div>
        <div class="admin-actions">
          <form class="span-all admin-profile-form" method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="update_user">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <input type="hidden" name="credits" value="' . (int) $user['credits'] . '">
            <label><span>' . h(t('Courriel', 'Email')) . '</span><input type="email" name="email" value="' . h((string) $user['email']) . '" required></label>
            <label><span>' . h(t('Nom', 'Name')) . '</span><input type="text" name="display_name" value="' . h((string) $user['display_name']) . '"></label>
            <label><span>' . h(t('Statut', 'Status')) . '</span><select name="status">' . admin_status_options($status) . '</select></label>
            <button type="submit">' . h(t('Enregistrer profil', 'Save profile')) . '</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="reset_password">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <label><span>' . h(t('Nouveau mot de passe', 'New password')) . '</span><input type="password" name="password" minlength="8" required></label>
            <button type="submit">' . h(t('Reset mot de passe', 'Reset password')) . '</button>
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
            <label><span>' . h(t('Archivage avec retention', 'Archive with retention')) . '</span><input type="text" name="confirm" placeholder="' . h(t('taper DELETE pour confirmer', 'type DELETE to confirm')) . '"></label>
            <button type="submit">' . h(t('Archiver utilisateur', 'Archive user')) . '</button>
          </form>
        </div>
      </section>
    ';
}

function render_client_credits_panel(PDO $pdo, ?array $user): string
{
    if ($user === null) {
        return '<section class="panel"><h2>' . h(t('Credits client', 'Client credits')) . '</h2><p>' . h(t('Selectionne un client dans l onglet Clients.', 'Select a client from the Clients tab.')) . '</p></section>';
    }
    $userId = (int) $user['id'];
    $modalHash = '#' . admin_tab_value((string) ($_GET['return_tab'] ?? 'admin-clients'));
    $contextKeys = ['key', 'user_id', 'return_tab', 'client_panel'];
    $tableState = admin_table_state('client_credits_table', [
        'delta' => 'int',
        'reason' => 'string',
        'reference' => 'string',
        'created_at' => 'date',
    ], 'created_at');
    $ledger = $pdo->prepare('SELECT delta, reason, reference, created_at FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC');
    $ledger->execute([$userId]);
    $ledgerAll = $ledger->fetchAll();
    $ledgerItems = admin_apply_table_state($ledgerAll, $tableState, [
        'delta' => 'int',
        'reason' => 'string',
        'reference' => 'string',
        'created_at' => 'date',
    ]);
    $rows = '';
    foreach ($ledgerItems as $row) {
        $rows .= '<tr><td>' . (int) $row['delta'] . '</td><td>' . h((string) $row['reason']) . '</td><td>' . h((string) $row['reference']) . '</td><td>' . h((string) $row['created_at']) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="4">' . h(t('Aucune entree.', 'No entry.')) . '</td></tr>';

    return '
      <section class="panel">
        <h2>' . h(t('Credits client', 'Client credits')) . '</h2>
        <div class="client-summary compact">
          <div class="stat"><span>' . h(t('Client', 'Client')) . '</span><strong>' . h((string) $user['email']) . '</strong></div>
          <div class="stat"><span>' . h(t('Solde', 'Balance')) . '</span><strong>' . (int) $user['credits'] . '</strong></div>
          <div class="stat"><span>' . h(t('Statut', 'Status')) . '</span>' . admin_log_badge(admin_user_status_tone((string) ($user['status'] ?? 'active')), admin_user_status_label((string) ($user['status'] ?? 'active'))) . '</div>
        </div>
        <form class="admin-directory-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="adjust_credits">
          <input type="hidden" name="user_id" value="' . $userId . '">
          <label><span>' . h(t('Ajustement credits', 'Credit adjustment')) . '</span><input type="number" name="delta" step="1" required></label>
          <label><span>' . h(t('Note', 'Note')) . '</span><input type="text" name="note" placeholder="' . h(t('raison interne', 'internal reason')) . '"></label>
          <button type="submit">' . h(t('Appliquer', 'Apply')) . '</button>
        </form>
      </section>
      <section class="panel"><h2>' . h(t('Historique credits', 'Credit history')) . '</h2>' . admin_table_controls_with_context('client_credits_table', $tableState, $modalHash, count($ledgerAll), t('lignes', 'rows'), $contextKeys) . '<div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context(t('Delta', 'Delta'), 'client_credits_table', 'delta', $tableState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Raison', 'Reason'), 'client_credits_table', 'reason', $tableState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Reference', 'Reference'), 'client_credits_table', 'reference', $tableState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'client_credits_table', 'created_at', $tableState, $modalHash, $contextKeys) . '</th></tr></thead><tbody>' . $rows . '</tbody></table></div></section>
    ';
}

function render_admin_modal_shell(string $title, string $closeUrl, string $body): string
{
    return '
      <div class="admin-modal-backdrop" data-admin-modal data-close-url="' . h($closeUrl) . '">
        <article class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" tabindex="-1">
          <header class="admin-modal-header">
            <h2 id="admin-modal-title">' . h($title) . '</h2>
            <a class="secondary compact-link" href="' . h($closeUrl) . '" data-modal-close>' . h(t('Fermer', 'Close')) . '</a>
          </header>
          <div class="admin-modal-body">' . $body . '</div>
        </article>
      </div>
    ';
}

function render_client_billing_detail_panel(PDO $pdo, array $user): string
{
    $userId = (int) $user['id'];
    $modalHash = '#' . admin_tab_value((string) ($_GET['return_tab'] ?? 'admin-clients'));
    $contextKeys = ['key', 'user_id', 'return_tab', 'client_panel'];
    $subscriptionState = admin_table_state('client_subscriptions_table', [
        'plan' => 'string',
        'status' => 'string',
        'provider' => 'string',
        'current_period_end' => 'date',
        'cancel_at_period_end' => 'bool',
        'updated_at' => 'date',
    ], 'updated_at');
    $paymentState = admin_table_state('client_payments_table', [
        'id' => 'int',
        'amount_cents' => 'int',
        'status' => 'string',
        'description' => 'string',
        'invoice' => ['type' => 'string', 'value' => static fn (array $row): string => ((string) ($row['invoice_url'] ?? '') !== '' || (string) ($row['invoice_pdf'] ?? '') !== '') ? '1' : '0'],
        'created_at' => 'date',
    ], 'created_at');
    $subscriptions = $pdo->prepare('SELECT plan, status, provider, current_period_end, cancel_at_period_end, updated_at FROM subscriptions WHERE user_id = ? ORDER BY id DESC');
    $subscriptions->execute([$userId]);
    $payments = $pdo->prepare('SELECT id, amount_cents, currency, status, description, invoice_url, invoice_pdf, created_at FROM payments WHERE user_id = ? ORDER BY id DESC');
    $payments->execute([$userId]);
    $subscriptionItemsAll = $subscriptions->fetchAll();
    $subscriptionItems = admin_apply_table_state($subscriptionItemsAll, $subscriptionState, [
        'plan' => 'string',
        'status' => 'string',
        'provider' => 'string',
        'current_period_end' => 'date',
        'cancel_at_period_end' => 'bool',
        'updated_at' => 'date',
    ]);
    $latestSubscription = $subscriptionItemsAll[0] ?? [
        'plan' => 'none',
        'status' => (string) ($user['subscription_status'] ?? 'none'),
        'provider' => '',
        'current_period_end' => '',
    ];
    $subscriptionRows = '';
    foreach ($subscriptionItems as $row) {
        $subscriptionStatus = (string) ($row['status'] ?? '');
        $subscriptionRows .= '<tr><td><strong>' . h(admin_plan_label((string) $row['plan'])) . '</strong></td><td>' . admin_log_badge(admin_subscription_status_tone($subscriptionStatus), admin_subscription_status_label($subscriptionStatus)) . '</td><td>' . h(admin_provider_label((string) $row['provider'])) . '</td><td>' . h((string) ($row['current_period_end'] ?: '-')) . '</td><td>' . h(admin_bool_label((int) $row['cancel_at_period_end'] === 1, t('Oui', 'Yes'), t('Non', 'No'))) . '</td><td>' . h((string) $row['updated_at']) . '</td></tr>';
    }
    $subscriptionRows = $subscriptionRows ?: '<tr><td colspan="6">' . h(t('Aucun abonnement synchronise.', 'No synchronized subscription.')) . '</td></tr>';
    $paymentItemsAll = $payments->fetchAll();
    $paymentItems = admin_apply_table_state($paymentItemsAll, $paymentState, [
        'id' => 'int',
        'amount_cents' => 'int',
        'status' => 'string',
        'description' => 'string',
        'invoice' => ['type' => 'string', 'value' => static fn (array $row): string => ((string) ($row['invoice_url'] ?? '') !== '' || (string) ($row['invoice_pdf'] ?? '') !== '') ? '1' : '0'],
        'created_at' => 'date',
    ]);
    $paymentRows = '';
    foreach ($paymentItems as $row) {
        $invoiceLinks = ((string) $row['invoice_url'] !== '' ? '<a href="' . h((string) $row['invoice_url']) . '" target="_blank" rel="noreferrer">' . h(t('Voir', 'View')) . '</a> ' : '')
            . ((string) $row['invoice_pdf'] !== '' ? '<a href="' . h((string) $row['invoice_pdf']) . '" target="_blank" rel="noreferrer">PDF</a>' : '');
        $paymentStatus = (string) ($row['status'] ?? '');
        $paymentRows .= '<tr><td>' . (int) $row['id'] . '</td><td>' . h(money_cents((int) $row['amount_cents'], (string) $row['currency'])) . '</td><td>' . admin_log_badge(admin_payment_status_tone($paymentStatus), admin_payment_status_label($paymentStatus)) . '</td><td>' . h((string) $row['description']) . '</td><td>' . ($invoiceLinks ?: '-') . '</td><td>' . h((string) $row['created_at']) . '</td></tr>';
    }
    $paymentRows = $paymentRows ?: '<tr><td colspan="6">' . h(t('Aucun paiement synchronise.', 'No synchronized payment.')) . '</td></tr>';
    $periodValue = h(substr((string) ($latestSubscription['current_period_end'] ?? ''), 0, 10));
    $latestSubscriptionState = (string) ($latestSubscription['status'] ?? 'none');
    $latestSubscriptionProvider = (string) ($latestSubscription['provider'] ?? '');

    return '
      <section class="modal-section">
        <div class="client-summary compact">
          <div class="stat"><span>' . h(t('Plan courant', 'Current plan')) . '</span><strong>' . h(admin_plan_label((string) $latestSubscription['plan'])) . '</strong></div>
          <div class="stat"><span>' . h(t('Etat', 'Status')) . '</span>' . admin_log_badge(admin_subscription_status_tone($latestSubscriptionState), admin_subscription_status_label($latestSubscriptionState)) . '</div>
          <div class="stat"><span>Provider</span><strong>' . h($latestSubscriptionProvider !== '' ? admin_provider_label($latestSubscriptionProvider) : '-') . '</strong></div>
        </div>
      </section>
      <section class="modal-section">
        <h3>' . h(t('Abonnement', 'Subscription')) . '</h3>
        <form class="admin-directory-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="set_subscription">
          <input type="hidden" name="user_id" value="' . $userId . '">
          <label><span>Plan</span><select name="plan">' . admin_plan_options((string) $latestSubscription['plan']) . '</select></label>
          <label><span>' . h(t('Etat abonnement', 'Subscription status')) . '</span><select name="subscription_status">' . admin_subscription_status_options((string) $latestSubscription['status']) . '</select></label>
          <label><span>' . h(t('Fin periode', 'Period end')) . '</span><input type="date" name="current_period_end" value="' . $periodValue . '"></label>
          <button type="submit">' . h(t('Mettre a jour abonnement', 'Update subscription')) . '</button>
        </form>
      </section>
      <section class="modal-section"><h3>' . h(t('Historique abonnements', 'Subscription history')) . '</h3>' . admin_table_controls_with_context('client_subscriptions_table', $subscriptionState, $modalHash, count($subscriptionItemsAll), t('lignes', 'rows'), $contextKeys) . '<div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context(t('Plan', 'Plan'), 'client_subscriptions_table', 'plan', $subscriptionState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Etat', 'Status'), 'client_subscriptions_table', 'status', $subscriptionState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context('Provider', 'client_subscriptions_table', 'provider', $subscriptionState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Fin periode', 'Period end'), 'client_subscriptions_table', 'current_period_end', $subscriptionState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Annule fin', 'Cancel at end'), 'client_subscriptions_table', 'cancel_at_period_end', $subscriptionState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('MAJ', 'Updated'), 'client_subscriptions_table', 'updated_at', $subscriptionState, $modalHash, $contextKeys) . '</th></tr></thead><tbody>' . $subscriptionRows . '</tbody></table></div></section>
      <section class="modal-section"><h3>' . h(t('Paiements', 'Payments')) . '</h3>' . admin_table_controls_with_context('client_payments_table', $paymentState, $modalHash, count($paymentItemsAll), t('lignes', 'rows'), $contextKeys) . '<div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context('ID', 'client_payments_table', 'id', $paymentState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Montant', 'Amount'), 'client_payments_table', 'amount_cents', $paymentState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Etat', 'Status'), 'client_payments_table', 'status', $paymentState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Description', 'Description'), 'client_payments_table', 'description', $paymentState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Facture', 'Invoice'), 'client_payments_table', 'invoice', $paymentState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'client_payments_table', 'created_at', $paymentState, $modalHash, $contextKeys) . '</th></tr></thead><tbody>' . $paymentRows . '</tbody></table></div></section>
    ';
}

function render_client_exports_detail_panel(PDO $pdo, array $user): string
{
    $modalHash = '#' . admin_tab_value((string) ($_GET['return_tab'] ?? 'admin-clients'));
    $contextKeys = ['key', 'user_id', 'return_tab', 'client_panel'];
    $tableState = admin_table_state('client_exports_table', [
        'export_type' => 'string',
        'credit_cost' => 'int',
        'status' => 'string',
        'created_at' => 'date',
        'consumed_at' => 'date',
    ], 'created_at');
    $exports = $pdo->prepare('SELECT export_type, credit_cost, status, created_at, consumed_at FROM export_authorizations WHERE user_id = ? ORDER BY id DESC');
    $exports->execute([(int) $user['id']]);
    $exportItemsAll = $exports->fetchAll();
    $exportItems = admin_apply_table_state($exportItemsAll, $tableState, [
        'export_type' => 'string',
        'credit_cost' => 'int',
        'status' => 'string',
        'created_at' => 'date',
        'consumed_at' => 'date',
    ]);
    $rows = '';
    foreach ($exportItems as $row) {
        $status = (string) ($row['status'] ?? '');
        $rows .= '<tr><td>' . h((string) $row['export_type']) . '</td><td>' . (int) $row['credit_cost'] . '</td><td>' . admin_log_badge(admin_export_status_tone($status), admin_export_status_label($status)) . '</td><td>' . h((string) $row['created_at']) . '</td><td>' . h((string) ($row['consumed_at'] ?: '-')) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="5">' . h(t('Aucun export.', 'No export.')) . '</td></tr>';
    return '<section class="modal-section"><h3>' . h(t('Exports client', 'Client exports')) . '</h3>' . admin_table_controls_with_context('client_exports_table', $tableState, $modalHash, count($exportItemsAll), t('lignes', 'rows'), $contextKeys) . '<div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context(t('Type', 'Type'), 'client_exports_table', 'export_type', $tableState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Cout', 'Cost'), 'client_exports_table', 'credit_cost', $tableState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Etat', 'Status'), 'client_exports_table', 'status', $tableState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Cree', 'Created'), 'client_exports_table', 'created_at', $tableState, $modalHash, $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Consomme', 'Consumed'), 'client_exports_table', 'consumed_at', $tableState, $modalHash, $contextKeys) . '</th></tr></thead><tbody>' . $rows . '</tbody></table></div></section>';
}

function render_client_modal(PDO $pdo, array $user, string $closeUrl, string $activePanel): string
{
    $title = 'Client #' . (int) $user['id'] . ' - ' . (string) $user['email'];
    $profile = render_client_profile_panel($user);
    $credits = render_client_credits_panel($pdo, $user);
    $billing = render_client_billing_detail_panel($pdo, $user);
    $exports = render_client_exports_detail_panel($pdo, $user);
    $tabs = [
        'client-profile' => t('Profil', 'Profile'),
        'client-credits' => t('Credits', 'Credits'),
        'client-billing' => t('Facturation', 'Billing'),
        'client-exports' => t('Exports', 'Exports'),
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
      <nav class="modal-tab-nav" data-modal-tabs role="tablist" aria-label="' . h(t('Sections client', 'Client sections')) . '">
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
        $messageRows .= '<article class="ticket-message ' . h($role) . '"><header><strong>' . h($role === 'admin' ? 'Support' : t('Client', 'Client')) . '</strong><span>' . h((string) $message['created_at']) . '</span></header><p>' . nl2br(h((string) $message['body'])) . '</p></article>';
    }
    $messageRows = $messageRows ?: '<p>' . h(t('Aucun message.', 'No message.')) . '</p>';
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
          <a class="secondary compact-link" href="' . h($clientHref) . '">' . h(t('Ouvrir client', 'Open client')) . '</a>
        </div>
        <div class="client-summary compact">
          <div class="stat"><span>' . h(t('Compte', 'Account')) . '</span>' . admin_log_badge(admin_user_status_tone((string) $ticket['user_status']), admin_user_status_label((string) $ticket['user_status'])) . '</div>
          <div class="stat"><span>' . h(t('Credits', 'Credits')) . '</span><strong>' . (int) $ticket['credits'] . '</strong></div>
          <div class="stat"><span>' . h(t('Ticket', 'Ticket')) . '</span>' . admin_log_badge(admin_ticket_status_tone((string) $ticket['status']), admin_ticket_status_label((string) $ticket['status'])) . '</div>
        </div>
      </section>
      <section class="modal-section">
        <h3>' . h(t('Fil de conversation', 'Conversation thread')) . '</h3>
        <p>' . h(t('Priorite', 'Priority')) . ': ' . h(admin_ticket_priority_label((string) ($ticket['priority'] ?? 'normal'))) . ' · ' . h(t('Assigne', 'Assigned')) . ': ' . h((string) ($ticket['assigned_to'] ?: '-')) . '</p>
        <div class="ticket-thread">' . $messageRows . '</div>
      </section>
      <section class="modal-section">
        <div class="ticket-admin-forms">
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="reply_ticket">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>' . h(t('Reponse support', 'Support reply')) . '</span><textarea name="body" maxlength="5000" rows="4"' . $disabledReply . '></textarea></label>
            <button type="submit"' . $disabledReply . '>' . h(t('Envoyer reponse client', 'Send client reply')) . '</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="set_ticket_status">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>' . h(t('Statut', 'Status')) . '</span><select name="ticket_status">' . $statusOptions . '</select></label>
            <button type="submit">' . h(t('Fermer / reouvrir', 'Close / reopen')) . '</button>
          </form>
          <form method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="update_ticket_meta">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>' . h(t('Priorite', 'Priority')) . '</span><select name="priority">' . $priorityOptions . '</select></label>
            <label><span>' . h(t('Assigne a', 'Assigned to')) . '</span><input type="text" name="assigned_to" maxlength="120" value="' . h((string) ($ticket['assigned_to'] ?? '')) . '"></label>
            <button type="submit">' . h(t('Mettre a jour', 'Update')) . '</button>
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

function admin_bool_label(bool $value, string $trueLabel = '', string $falseLabel = ''): string
{
    if ($trueLabel === '') {
        $trueLabel = t('Actif', 'Active');
    }
    if ($falseLabel === '') {
        $falseLabel = t('Inactif', 'Inactive');
    }
    return $value ? $trueLabel : $falseLabel;
}

function admin_db_driver_label(string $driver): string
{
    return $driver === 'mysql' ? 'MySQL cPanel' : t('SQLite local', 'Local SQLite');
}

function admin_secret_source_label(bool $fromEnv, bool $hasStored, string $kind = 'Secret'): string
{
    if ($fromEnv) {
        return $kind . t(' via variable serveur', ' from server variable');
    }
    if ($hasStored) {
        return $kind . t(' enregistre', ' saved');
    }
    return $kind . t(' absent', ' missing');
}

function admin_notice_label(string $notice): string
{
    $normalized = strtolower(trim($notice));
    if ($normalized === '') {
        return '';
    }
    if (str_starts_with($normalized, 'email_test_erreur_')) {
        return t('Le test email a echoue.', 'Email test failed.');
    }

    return match ($normalized) {
        'creation_invalide' => t('Creation utilisateur invalide.', 'Invalid user creation request.'),
        'client_cree' => t('Client cree.', 'Client created.'),
        'creation_erreur' => t('Erreur pendant la creation du client.', 'Error while creating the client.'),
        'profil_invalide' => t('Profil client invalide.', 'Invalid client profile.'),
        'profil_modifie' => t('Profil client mis a jour.', 'Client profile updated.'),
        'profil_erreur' => t('Erreur pendant la mise a jour du profil.', 'Error while updating the profile.'),
        'mot_de_passe_invalide' => t('Mot de passe invalide.', 'Invalid password.'),
        'mot_de_passe_modifie' => t('Mot de passe mis a jour.', 'Password updated.'),
        'confirmation_requise' => t('Confirmation requise pour archiver le client.', 'Confirmation required to archive the client.'),
        'client_archive' => t('Client archive.', 'Client archived.'),
        'suppression_erreur' => t('Erreur pendant l archivage du client.', 'Error while archiving the client.'),
        'delta_zero' => t('Ajustement de credits invalide.', 'Invalid credit adjustment.'),
        'credits_ajustes' => t('Credits ajustes.', 'Credits adjusted.'),
        'erreur_credits' => t('Erreur pendant l ajustement des credits.', 'Error while adjusting credits.'),
        'statut_invalide' => t('Statut invalide.', 'Invalid status.'),
        'statut_modifie' => t('Statut mis a jour.', 'Status updated.'),
        'statut_erreur' => t('Erreur pendant la mise a jour du statut.', 'Error while updating status.'),
        'abonnement_invalide' => t('Abonnement invalide.', 'Invalid subscription.'),
        'abonnement_modifie' => t('Abonnement mis a jour.', 'Subscription updated.'),
        'erreur_abonnement' => t('Erreur pendant la mise a jour de l abonnement.', 'Error while updating the subscription.'),
        'client_invalide' => t('Client invalide.', 'Invalid client.'),
        'client_introuvable' => t('Client introuvable.', 'Client not found.'),
        'action_inconnue' => t('Action admin inconnue.', 'Unknown admin action.'),
        'ticket_introuvable' => t('Ticket introuvable.', 'Ticket not found.'),
        'ticket_ferme' => t('Le ticket est ferme.', 'The ticket is closed.'),
        'message_ticket_invalide' => t('Reponse ticket invalide.', 'Invalid ticket reply.'),
        'reponse_ticket_envoyee' => t('Reponse ticket envoyee.', 'Ticket reply sent.'),
        'erreur_ticket' => t('Erreur ticket.', 'Ticket error.'),
        'statut_ticket_invalide' => t('Statut ticket invalide.', 'Invalid ticket status.'),
        'statut_ticket_modifie' => t('Statut ticket mis a jour.', 'Ticket status updated.'),
        'meta_ticket_invalide' => t('Meta ticket invalide.', 'Invalid ticket metadata.'),
        'ticket_modifie' => t('Ticket mis a jour.', 'Ticket updated.'),
        'smtp_invalide' => t('Configuration SMTP invalide.', 'Invalid SMTP configuration.'),
        'smtp_champs_requis' => t('Les champs SMTP requis sont manquants.', 'Missing required SMTP fields.'),
        'smtp_modifie' => t('Configuration SMTP enregistree.', 'SMTP settings saved.'),
        'email_test_invalide' => t('Adresse de test invalide.', 'Invalid test address.'),
        'email_test_envoye' => t('Email de test envoye.', 'Test email sent.'),
        'stripe_devise_invalide' => t('Devise Stripe invalide.', 'Invalid Stripe currency.'),
        'stripe_prix_requis' => t('Prix Stripe requis.', 'Stripe prices are required.'),
        'stripe_modifie' => t('Configuration Stripe enregistree.', 'Stripe settings saved.'),
        'db_champs_requis' => t('Les champs base de donnees requis sont manquants.', 'Missing required database fields.'),
        'db_sqlite_requis' => t('Le chemin SQLite est requis.', 'SQLite path is required.'),
        'db_modifie' => t('Configuration base de donnees enregistree.', 'Database settings saved.'),
        'db_connexion_ok' => t('Connexion base de donnees validee.', 'Database connection validated.'),
        'db_connexion_erreur' => t('Erreur de connexion a la base.', 'Database connection failed.'),
        default => admin_code_label($notice),
    };
}

function render_email_settings_panel(PDO $pdo): string
{
    $contextKeys = ['key'];
    $settings = mail_settings($pdo);
    $tableState = admin_table_state('settings_emails_table', [
        'id' => 'int',
        'ticket_id' => 'int',
        'recipient' => 'string',
        'subject' => 'string',
        'status' => 'string',
        'error' => 'string',
        'sent_at' => ['type' => 'date', 'value' => static fn (array $row): string => (string) ($row['sent_at'] ?: $row['created_at'])],
    ], 'sent_at');
    $encryptionOptions = '';
    foreach (SMTP_ENCRYPTIONS as $option) {
        $selected = $settings['encryption'] === $option ? ' selected' : '';
        $encryptionOptions .= '<option value="' . h($option) . '"' . $selected . '>' . h(admin_smtp_encryption_label($option)) . '</option>';
    }
    $recent = $pdo->query('SELECT id, ticket_id, recipient, subject, status, error, created_at, sent_at FROM ticket_notifications')->fetchAll();
    $recentTable = admin_apply_table_state($recent, $tableState, [
        'id' => 'int',
        'ticket_id' => 'int',
        'recipient' => 'string',
        'subject' => 'string',
        'status' => 'string',
        'error' => 'string',
        'sent_at' => ['type' => 'date', 'value' => static fn (array $row): string => (string) ($row['sent_at'] ?: $row['created_at'])],
    ]);
    $rows = '';
    foreach ($recentTable as $row) {
        $status = (string) ($row['status'] ?? '');
        $rows .= '<tr><td>' . (int) $row['id'] . '</td><td>#' . (int) $row['ticket_id'] . '</td><td>' . h((string) $row['recipient']) . '</td><td>' . h((string) $row['subject']) . '</td><td>' . admin_log_badge(admin_notification_status_tone($status), admin_notification_status_label($status)) . '</td><td>' . h(admin_notification_error_label((string) ($row['error'] ?? ''))) . '</td><td>' . h((string) ($row['sent_at'] ?: $row['created_at'])) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="7">' . h(t('Aucun email ticket.', 'No ticket email.')) . '</td></tr>';
    $passwordNote = getenv('NICHOIR_SMTP_PASSWORD') ? t('Mot de passe fourni par variable serveur NICHOIR_SMTP_PASSWORD.', 'Password provided by server variable NICHOIR_SMTP_PASSWORD.') : t('Laisser vide pour conserver le mot de passe actuel.', 'Leave empty to keep the current password.');
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
            <h2>' . h(t('Email tickets', 'Ticket email')) . '</h2>
            <p>' . h(t('Configure le relais SMTP utilise pour les tickets, puis valide l envoi avant de compter dessus en production.', 'Configure the SMTP relay used for tickets, then validate delivery before relying on it in production.')) . '</p>
          </div>
          <div>' . admin_log_badge($settings['enabled'] ? 'success' : 'neutral', admin_bool_label($settings['enabled'], t('SMTP actif', 'SMTP active'), t('SMTP inactif', 'SMTP inactive'))) . '</div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>' . h(t('Etat', 'Status')) . '</span><strong>' . h(admin_bool_label($settings['enabled'], t('Actif', 'Active'), t('Inactif', 'Inactive'))) . '</strong></div>
          <div class="stat"><span>Support</span><strong>' . h((string) ($settings['support_email'] ?: '-')) . '</strong></div>
          <div class="stat"><span>' . h(t('Envoyes', 'Sent')) . '</span><strong>' . $sentCount . '</strong></div>
          <div class="stat"><span>' . h(t('Echecs', 'Failures')) . '</span><strong>' . $failedCount . '</strong></div>
        </div>
        <form class="admin-email-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="update_email_settings">
          <label class="checkbox-label"><input type="checkbox" name="smtp_enabled" value="1"' . ($settings['enabled'] ? ' checked' : '') . '> ' . h(t('Activer envoi SMTP', 'Enable SMTP sending')) . '</label>
          <label><span>' . h(t('Serveur SMTP', 'SMTP server')) . '</span><input type="text" name="smtp_host" value="' . h((string) $settings['host']) . '" placeholder="mail.domaine.com"></label>
          <label><span>Port</span><input type="number" name="smtp_port" min="1" max="65535" value="' . (int) $settings['port'] . '"></label>
          <label><span>' . h(t('Chiffrement', 'Encryption')) . '</span><select name="smtp_encryption">' . $encryptionOptions . '</select></label>
          <label><span>' . h(t('Utilisateur SMTP', 'SMTP username')) . '</span><input type="text" name="smtp_username" value="' . h((string) $settings['username']) . '" autocomplete="username"></label>
          <label><span>' . h(t('Mot de passe SMTP', 'SMTP password')) . '</span><input type="password" name="smtp_password" autocomplete="new-password" placeholder="' . h($passwordNote) . '"></label>
          <label><span>' . h(t('Email expediteur', 'Sender email')) . '</span><input type="email" name="smtp_from_email" value="' . h((string) $settings['from_email']) . '" placeholder="support@domaine.com"></label>
          <label><span>' . h(t('Nom expediteur', 'Sender name')) . '</span><input type="text" name="smtp_from_name" value="' . h((string) $settings['from_name']) . '" maxlength="120"></label>
          <label><span>' . h(t('Email support', 'Support email')) . '</span><input type="email" name="support_email" value="' . h((string) $settings['support_email']) . '" placeholder="support@domaine.com"></label>
          <button type="submit">' . h(t('Enregistrer email', 'Save email settings')) . '</button>
        </form>
        <div class="settings-subsection">
          <div class="section-heading log-section-heading">
            <div>
              <h3>' . h(t('Test d envoi', 'Send test')) . '</h3>
              <p>' . h(t('Valide les identifiants SMTP et l expedition reelle avant de fermer la configuration.', 'Validate SMTP credentials and real delivery before closing the configuration.')) . '</p>
            </div>
          </div>
          <form class="admin-email-test" method="post" action="/admin">
            ' . admin_key_input() . '
            <input type="hidden" name="action" value="send_test_email">
            <label><span>' . h(t('Email test', 'Test email')) . '</span><input type="email" name="test_recipient" value="' . h((string) $settings['support_email']) . '" required></label>
            <button type="submit">' . h(t('Envoyer test', 'Send test')) . '</button>
          </form>
        </div>
        <div class="settings-subsection">
          <div class="section-heading log-section-heading">
            <div>
              <h3>' . h(t('Activite recente', 'Recent activity')) . '</h3>
              <p>' . h(t('Historique court des notifications tickets envoye es, ratees ou en attente.', 'Short history of ticket notifications sent, failed, or pending.')) . '</p>
            </div>
          </div>
          ' . admin_table_controls_with_context('settings_emails_table', $tableState, '#admin-settings', count($recent), t('emails', 'emails'), $contextKeys) . '
          <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context('ID', 'settings_emails_table', 'id', $tableState, '#admin-settings', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Ticket', 'Ticket'), 'settings_emails_table', 'ticket_id', $tableState, '#admin-settings', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Destinataire', 'Recipient'), 'settings_emails_table', 'recipient', $tableState, '#admin-settings', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Sujet', 'Subject'), 'settings_emails_table', 'subject', $tableState, '#admin-settings', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Etat', 'Status'), 'settings_emails_table', 'status', $tableState, '#admin-settings', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Erreur', 'Error'), 'settings_emails_table', 'error', $tableState, '#admin-settings', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'settings_emails_table', 'sent_at', $tableState, '#admin-settings', $contextKeys) . '</th></tr></thead><tbody>' . $rows . '</tbody></table></div>
        </div>
      </section>
    ';
}

function render_stripe_settings_panel(PDO $pdo): string
{
    $settings = stripe_settings($pdo);
    $secretNote = stripe_setting_secret_is_env('NICHOIR_STRIPE_SECRET_KEY') ? t('Cle fournie par NICHOIR_STRIPE_SECRET_KEY.', 'Key provided by NICHOIR_STRIPE_SECRET_KEY.') : t('Laisser vide pour conserver la cle actuelle.', 'Leave empty to keep the current key.');
    $webhookNote = stripe_setting_secret_is_env('NICHOIR_STRIPE_WEBHOOK_SECRET') ? t('Secret fourni par NICHOIR_STRIPE_WEBHOOK_SECRET.', 'Secret provided by NICHOIR_STRIPE_WEBHOOK_SECRET.') : t('Laisser vide pour conserver le secret actuel.', 'Leave empty to keep the current secret.');
    $priceCount = 0;
    foreach (['price_credits', 'price_atelier', 'price_pro'] as $key) {
        if (trim((string) ($settings[$key] ?? '')) !== '') {
            $priceCount++;
        }
    }
    $secretSource = admin_secret_source_label(
        stripe_setting_secret_is_env('NICHOIR_STRIPE_SECRET_KEY'),
        trim((string) ($settings['secret_key'] ?? '')) !== '',
        t('Cle', 'Key')
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
            <p>' . h(t('Configure Checkout, portail client et verification webhook. Les secrets doivent idealement venir des variables serveur.', 'Configure Checkout, customer portal, and webhook verification. Secrets should ideally come from server variables.')) . '</p>
          </div>
          <div>' . admin_log_badge($settings['enabled'] ? 'success' : 'neutral', admin_bool_label($settings['enabled'], t('Stripe actif', 'Stripe active'), t('Stripe inactif', 'Stripe inactive'))) . '</div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>' . h(t('Etat', 'Status')) . '</span><strong>' . h(admin_bool_label($settings['enabled'])) . '</strong></div>
          <div class="stat"><span>' . h(t('Devise', 'Currency')) . '</span><strong>' . h(strtoupper((string) $settings['currency'])) . '</strong></div>
          <div class="stat"><span>Prices</span><strong>' . $priceCount . '</strong></div>
          <div class="stat"><span>' . h(t('Secrets', 'Secrets')) . '</span><strong>' . h($webhookSource) . '</strong></div>
        </div>
        <form class="admin-stripe-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <input type="hidden" name="action" value="update_stripe_settings">
          <label class="checkbox-label"><input type="checkbox" name="stripe_enabled" value="1"' . ($settings['enabled'] ? ' checked' : '') . '> ' . h(t('Activer Stripe reel', 'Enable live Stripe')) . '</label>
          <label><span>' . h(t('Cle secrete Stripe', 'Stripe secret key')) . '</span><input type="password" name="stripe_secret_key" autocomplete="new-password" placeholder="' . h($secretNote) . '"></label>
          <label><span>' . h(t('Webhook secret', 'Webhook secret')) . '</span><input type="password" name="stripe_webhook_secret" autocomplete="new-password" placeholder="' . h($webhookNote) . '"></label>
          <label><span>' . h(t('Devise', 'Currency')) . '</span><input type="text" name="stripe_currency" value="' . h((string) $settings['currency']) . '" maxlength="3"></label>
          <label><span>Price credits</span><input type="text" name="stripe_price_credits" value="' . h((string) $settings['price_credits']) . '" placeholder="price_..."></label>
          <label><span>' . h(t('Credits achetes', 'Purchased credits')) . '</span><input type="number" name="stripe_credits_quantity" min="1" step="1" value="' . (int) $settings['credits_quantity'] . '"></label>
          <label><span>Price atelier</span><input type="text" name="stripe_price_atelier" value="' . h((string) $settings['price_atelier']) . '" placeholder="price_..."></label>
          <label><span>Price pro</span><input type="text" name="stripe_price_pro" value="' . h((string) $settings['price_pro']) . '" placeholder="price_..."></label>
          <button type="submit">' . h(t('Enregistrer Stripe', 'Save Stripe settings')) . '</button>
        </form>
        <p class="section-hint settings-inline-hint">' . h(t('Source cle', 'Key source')) . ': ' . h($secretSource) . ' · ' . h(t('Source webhook', 'Webhook source')) . ': ' . h($webhookSource) . '</p>
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
        ? t('Mot de passe fourni par NICHOIR_DB_PASSWORD.', 'Password provided by NICHOIR_DB_PASSWORD.')
        : (((string) ($local['mysql_password'] ?? '') !== '') ? t('Laisser vide pour conserver le mot de passe enregistre.', 'Leave empty to keep the saved password.') : t('Mot de passe utilisateur MySQL cPanel.', 'cPanel MySQL user password.'));
    $sourceLabel = $env !== [] ? t('Variables serveur', 'Server variables') : (is_file(db_config_path()) ? t('Config locale', 'Local config') : t('SQLite par defaut', 'Default SQLite'));
    $configLabel = is_file(db_config_path()) ? 'data/db-config.php' : t('Aucun fichier local', 'No local file');

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>' . h(t('Base de donnees', 'Database')) . '</h2>
            <p>' . h(t('Choisis le driver actif, renseigne la connexion cible, puis teste avant enregistrement. Le schema MySQL est cree si la base est vide.', 'Choose the active driver, fill in the target connection, then test before saving. The MySQL schema is created if the database is empty.')) . '</p>
          </div>
          <div>' . admin_log_badge($driver === 'mysql' ? 'info' : 'neutral', admin_db_driver_label($driver)) . '</div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>' . h(t('Driver actif', 'Active driver')) . '</span><strong>' . h(admin_db_driver_label($driver)) . '</strong></div>
          <div class="stat"><span>' . h(t('Source', 'Source')) . '</span><strong>' . h($sourceLabel) . '</strong></div>
          <div class="stat"><span>' . h(t('Config locale', 'Local config')) . '</span><strong>' . h($configLabel) . '</strong></div>
          <div class="stat"><span>' . h(t('Mode local', 'Local mode')) . '</span><strong>' . h($driver === 'sqlite' ? t('Oui', 'Yes') : t('Non', 'No')) . '</strong></div>
        </div>
        <form class="admin-db-form" method="post" action="/admin">
          ' . admin_key_input() . '
          <fieldset class="db-driver-choice">
            <legend>Driver</legend>
            <label class="checkbox-label"><input type="radio" name="db_driver" value="sqlite"' . $sqliteChecked . '> ' . h(t('SQLite local', 'Local SQLite')) . '</label>
            <label class="checkbox-label"><input type="radio" name="db_driver" value="mysql"' . $mysqlChecked . '> MySQL cPanel</label>
          </fieldset>
          <label><span>' . h(t('Chemin SQLite', 'SQLite path')) . '</span><input type="text" name="sqlite_path" value="' . h((string) $config['sqlite_path']) . '"></label>
          <label><span>Host MySQL</span><input type="text" name="mysql_host" value="' . h((string) $config['mysql_host']) . '" placeholder="localhost"></label>
          <label><span>Port</span><input type="number" name="mysql_port" min="1" max="65535" value="' . h((string) $config['mysql_port']) . '"></label>
          <label><span>' . h(t('Nom base', 'Database name')) . '</span><input type="text" name="mysql_database" value="' . h((string) $config['mysql_database']) . '" placeholder="cpaneluser_nichoir"></label>
          <label><span>' . h(t('Utilisateur', 'Username')) . '</span><input type="text" name="mysql_username" value="' . h((string) $config['mysql_username']) . '" autocomplete="username" placeholder="cpaneluser_dbuser"></label>
          <label><span>' . h(t('Mot de passe', 'Password')) . '</span><input type="password" name="mysql_password" autocomplete="new-password" placeholder="' . h($passwordNote) . '"></label>
          <label><span>Charset</span><input type="text" name="mysql_charset" value="' . h((string) $config['mysql_charset']) . '"></label>
          <div class="form-actions span-all">
            <button type="submit" name="action" value="test_database_settings">' . h(t('Tester connexion', 'Test connection')) . '</button>
            <button type="submit" name="action" value="update_database_settings">' . h(t('Enregistrer DB', 'Save DB settings')) . '</button>
          </div>
        </form>
        <p class="section-hint settings-inline-hint">' . h(t('Source active', 'Active source')) . ': ' . h($source) . '. ' . h(t('En production, preferer `NICHOIR_DB_*` aux secrets stockes localement.', 'In production, prefer `NICHOIR_DB_*` over secrets stored locally.')) . '</p>
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
        <div class="stat"><span>SMTP</span><strong>' . h(admin_bool_label((bool) $mail['enabled'])) . '</strong></div>
        <div class="stat"><span>Stripe</span><strong>' . h(admin_bool_label((bool) $stripe['enabled'])) . '</strong></div>
        <div class="stat"><span>' . h(t('Priorite', 'Priority')) . '</span><strong>' . h(t('Tester avant prod', 'Test before production')) . '</strong></div>
      </div>
    ';

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>' . h(t('Reglages systeme', 'System settings')) . '</h2>
            <p>' . h(t('Infrastructure, email et billing. Chaque bloc se configure separement et doit etre valide avant deploiement.', 'Infrastructure, email, and billing. Each block is configured separately and should be validated before deployment.')) . '</p>
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
    $contextKeys = [
        'key',
        'billing_scope',
        'billing_view',
        'billing_q',
        'billing_plan',
        'billing_provider',
        'billing_subscription_status',
        'billing_payment_status',
        'billing_currency',
        'billing_invoice',
        'billing_date_from',
        'billing_date_to',
        'billing_amount_min',
        'billing_amount_max',
    ];
    $scope = (string) $filters['billing_scope'];
    $billingView = (string) $filters['billing_view'];
    $subscriptionTableState = admin_table_state('billing_subscriptions_table', [
        'id' => 'int',
        'email' => 'string',
        'plan' => 'string',
        'subscription_state' => 'string',
        'provider' => 'string',
        'current_period_end' => 'date',
        'updated_at' => 'date',
    ], 'updated_at');
    $paymentTableState = admin_table_state('billing_payments_table', [
        'id' => 'int',
        'email' => 'string',
        'amount_cents' => 'int',
        'payment_state' => 'string',
        'description' => 'string',
        'invoice' => ['type' => 'string', 'value' => static fn (array $row): string => ((string) ($row['invoice_url'] ?? '') !== '' || (string) ($row['invoice_pdf'] ?? '') !== '') ? '1' : '0'],
        'created_at' => 'date',
    ], 'created_at');
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
    $subscriptionSql .= ' ORDER BY subscriptions.updated_at DESC, subscriptions.id DESC';
    $subscriptionStmt = $pdo->prepare($subscriptionSql);
    $subscriptionStmt->execute($subscriptionParams);
    $subscriptions = $subscriptionStmt->fetchAll();
    $subscriptionTableRows = admin_apply_table_state($subscriptions, $subscriptionTableState, [
        'id' => 'int',
        'email' => 'string',
        'plan' => 'string',
        'subscription_state' => 'string',
        'provider' => 'string',
        'current_period_end' => 'date',
        'updated_at' => 'date',
    ]);

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
    $paymentSql .= ' ORDER BY payments.created_at DESC, payments.id DESC';
    $paymentStmt = $pdo->prepare($paymentSql);
    $paymentStmt->execute($paymentParams);
    $payments = $paymentStmt->fetchAll();
    $paymentTableRows = admin_apply_table_state($payments, $paymentTableState, [
        'id' => 'int',
        'email' => 'string',
        'amount_cents' => 'int',
        'payment_state' => 'string',
        'description' => 'string',
        'invoice' => ['type' => 'string', 'value' => static fn (array $row): string => ((string) ($row['invoice_url'] ?? '') !== '' || (string) ($row['invoice_pdf'] ?? '') !== '') ? '1' : '0'],
        'created_at' => 'date',
    ]);
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
    $planMap = [];
    foreach ($planOptions as $value) {
        $planMap[(string) $value] = admin_plan_label((string) $value);
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
        $statusTone = admin_subscription_status_tone($subscriptionState);
        if (in_array($subscriptionState, ['active', 'trialing'], true)) {
            $activeSubscriptionCount++;
        }
        if ((string) ($subscription['current_period_end'] ?? '') !== '') {
            $upcomingSubscriptionCount++;
        }
        $subscriptionRows .= '<tr><td>' . (int) $subscription['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $subscription['email']) . '</a></td><td><strong>' . h(admin_plan_label((string) $subscription['plan'])) . '</strong></td><td>' . admin_log_badge($statusTone, admin_subscription_status_label($subscriptionState)) . '</td><td>' . h(admin_provider_label((string) ($subscription['provider'] ?: ''))) . '</td><td>' . h((string) ($subscription['current_period_end'] ?: '-')) . '</td><td>' . h((string) ($subscription['updated_at'] ?: '-')) . '</td></tr>';
    }
    if ($subscriptionRows === '') {
        $subscriptionRows = '<tr><td colspan="7">' . h(t('Aucun abonnement pour ces filtres.', 'No subscription for these filters.')) . '</td></tr>';
    }

    $paymentRows = '';
    $paymentCurrencies = [];
    $paymentInvoiceCount = 0;
    $paidPaymentCount = 0;
    foreach ($payments as $payment) {
        $clientHref = admin_client_modal_url((int) $payment['user_id'], 'admin-billing', 'billing', $filters);
        $invoiceLinks = ((string) $payment['invoice_url'] !== '' ? '<a href="' . h((string) $payment['invoice_url']) . '" target="_blank" rel="noreferrer">' . h(t('Voir', 'View')) . '</a> ' : '')
            . ((string) $payment['invoice_pdf'] !== '' ? '<a href="' . h((string) $payment['invoice_pdf']) . '" target="_blank" rel="noreferrer">PDF</a>' : '');
        if ($invoiceLinks !== '') {
            $paymentInvoiceCount++;
        }
        $paymentState = (string) $payment['payment_state'];
        $statusTone = admin_payment_status_tone($paymentState);
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
        $paymentRows = '<tr><td colspan="7">' . h(t('Aucun paiement pour ces filtres.', 'No payment for these filters.')) . '</td></tr>';
    }

    $currencySummary = '-';
    if ($paymentCurrencies !== []) {
        $parts = [];
        foreach ($paymentCurrencies as $currencyCode => $value) {
            $parts[] = money_cents($value, $currencyCode === '' ? 'cad' : $currencyCode);
        }
        $currencySummary = implode(' / ', $parts);
    }
    $invoiceHtml = '<option value="">' . h(t('Toutes', 'All')) . '</option>'
        . '<option value="yes"' . ($invoice === 'yes' ? ' selected' : '') . '>' . h(t('Avec facture', 'With invoice')) . '</option>'
        . '<option value="no"' . ($invoice === 'no' ? ' selected' : '') . '>' . h(t('Sans facture', 'Without invoice')) . '</option>';
    $advancedFiltersOpen = $plan !== '' || $provider !== '' || $currency !== '' || $invoice !== '' || $amountMin !== '' || $amountMax !== '';
    $summaryCards = match ($scope) {
        'subscriptions' => '
          <div class="stat"><span>' . h(t('Abonnements', 'Subscriptions')) . '</span><strong>' . count($subscriptions) . '</strong></div>
          <div class="stat"><span>' . h(t('Actifs', 'Active')) . '</span><strong>' . $activeSubscriptionCount . '</strong></div>
          <div class="stat"><span>' . h(t('Echeances', 'Renewals')) . '</span><strong>' . $upcomingSubscriptionCount . '</strong></div>
          <div class="stat"><span>Providers</span><strong>' . $providerCount . '</strong></div>
        ',
        'payments' => '
          <div class="stat"><span>' . h(t('Paiements', 'Payments')) . '</span><strong>' . count($payments) . '</strong></div>
          <div class="stat"><span>' . h(t('Payes', 'Paid')) . '</span><strong>' . $paidPaymentCount . '</strong></div>
          <div class="stat"><span>' . h(t('Factures', 'Invoices')) . '</span><strong>' . $paymentInvoiceCount . '</strong></div>
          <div class="stat"><span>' . h(t('Total filtre', 'Filtered total')) . '</span><strong>' . h($currencySummary) . '</strong></div>
        ',
        default => '
          <div class="stat"><span>' . h(t('Abonnements', 'Subscriptions')) . '</span><strong>' . count($subscriptions) . '</strong></div>
          <div class="stat"><span>' . h(t('Paiements', 'Payments')) . '</span><strong>' . count($payments) . '</strong></div>
          <div class="stat"><span>' . h(t('Factures', 'Invoices')) . '</span><strong>' . $paymentInvoiceCount . '</strong></div>
          <div class="stat"><span>' . h(t('Total filtre', 'Filtered total')) . '</span><strong>' . h($currencySummary) . '</strong></div>
        ',
    };

    $contentNav = admin_billing_content_nav($filters, count($subscriptions), count($payments));
    $detailState = $billingView === 'payments' ? $paymentTableState : $subscriptionTableState;
    $detailKey = $billingView === 'payments' ? 'billing_payments_table' : 'billing_subscriptions_table';
    $detailTitle = $billingView === 'payments' ? t('Paiements filtres', 'Filtered payments') : t('Abonnements filtres', 'Filtered subscriptions');
    $detailDescription = $billingView === 'payments'
        ? t('Montants encaisses, statut de traitement et presence de facture.', 'Captured amounts, processing status, and invoice presence.')
        : t('Etat courant du plan, provider et prochaine echeance.', 'Current plan state, provider, and next renewal.');
    $detailCount = $billingView === 'payments' ? count($payments) : count($subscriptions);
    $detailTable = $billingView === 'payments'
        ? admin_table_controls_with_context('billing_payments_table', $paymentTableState, '#admin-billing', count($payments), t('paiements', 'payments'), $contextKeys) . '<div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context('ID', 'billing_payments_table', 'id', $paymentTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Client', 'Client'), 'billing_payments_table', 'email', $paymentTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Montant', 'Amount'), 'billing_payments_table', 'amount_cents', $paymentTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Etat', 'Status'), 'billing_payments_table', 'payment_state', $paymentTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Description', 'Description'), 'billing_payments_table', 'description', $paymentTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Facture', 'Invoice'), 'billing_payments_table', 'invoice', $paymentTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'billing_payments_table', 'created_at', $paymentTableState, '#admin-billing', $contextKeys) . '</th></tr></thead><tbody>' . implode('', array_map(static function (array $payment) use ($filters): string {
            $clientHref = admin_client_modal_url((int) $payment['user_id'], 'admin-billing', 'billing', $filters);
            $invoiceLinks = ((string) $payment['invoice_url'] !== '' ? '<a href="' . h((string) $payment['invoice_url']) . '" target="_blank" rel="noreferrer">' . h(t('Voir', 'View')) . '</a> ' : '')
                . ((string) $payment['invoice_pdf'] !== '' ? '<a href="' . h((string) $payment['invoice_pdf']) . '" target="_blank" rel="noreferrer">PDF</a>' : '');
            $paymentState = (string) $payment['payment_state'];
            return '<tr><td>' . (int) $payment['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $payment['email']) . '</a></td><td><strong>' . h(money_cents((int) $payment['amount_cents'], (string) $payment['currency'])) . '</strong></td><td>' . admin_log_badge(admin_payment_status_tone($paymentState), admin_payment_status_label($paymentState)) . '</td><td>' . h(admin_log_text((string) ($payment['description'] ?: '-'), 80)) . '</td><td>' . ($invoiceLinks ?: '-') . '</td><td>' . h((string) $payment['created_at']) . '</td></tr>';
        }, $paymentTableRows)) . ($paymentTableRows === [] ? '<tr><td colspan="7">' . h(t('Aucun paiement pour ces filtres.', 'No payment for these filters.')) . '</td></tr>' : '') . '</tbody></table></div>'
        : admin_table_controls_with_context('billing_subscriptions_table', $subscriptionTableState, '#admin-billing', count($subscriptions), t('abonnements', 'subscriptions'), $contextKeys) . '<div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context('ID', 'billing_subscriptions_table', 'id', $subscriptionTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Client', 'Client'), 'billing_subscriptions_table', 'email', $subscriptionTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Plan', 'Plan'), 'billing_subscriptions_table', 'plan', $subscriptionTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Etat', 'Status'), 'billing_subscriptions_table', 'subscription_state', $subscriptionTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context('Provider', 'billing_subscriptions_table', 'provider', $subscriptionTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Fin periode', 'Period end'), 'billing_subscriptions_table', 'current_period_end', $subscriptionTableState, '#admin-billing', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('MAJ', 'Updated'), 'billing_subscriptions_table', 'updated_at', $subscriptionTableState, '#admin-billing', $contextKeys) . '</th></tr></thead><tbody>' . implode('', array_map(static function (array $subscription) use ($filters): string {
            $clientHref = admin_client_modal_url((int) $subscription['user_id'], 'admin-billing', 'billing', $filters);
            $subscriptionState = (string) $subscription['subscription_state'];
            return '<tr><td>' . (int) $subscription['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $subscription['email']) . '</a></td><td><strong>' . h(admin_plan_label((string) $subscription['plan'])) . '</strong></td><td>' . admin_log_badge(admin_subscription_status_tone($subscriptionState), admin_subscription_status_label($subscriptionState)) . '</td><td>' . h(admin_provider_label((string) ($subscription['provider'] ?: ''))) . '</td><td>' . h((string) ($subscription['current_period_end'] ?: '-')) . '</td><td>' . h((string) ($subscription['updated_at'] ?: '-')) . '</td></tr>';
        }, $subscriptionTableRows)) . ($subscriptionTableRows === [] ? '<tr><td colspan="7">' . h(t('Aucun abonnement pour ces filtres.', 'No subscription for these filters.')) . '</td></tr>' : '') . '</tbody></table></div>';
    $detailHint = $scope === 'all'
        ? '<p class="section-hint billing-detail-hint">' . h(t('Les deux vues partagent les memes filtres. Bascule entre abonnements et paiements sans rallonger la page.', 'Both views share the same filters. Switch between subscriptions and payments without making the page longer.')) . '</p>'
        : '';

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>' . h(t('Facturation', 'Billing')) . '</h2>
            <p>' . h(t('Vue revenus et abonnements. Garde d abord la portee, la recherche et la periode, puis affine si besoin.', 'Revenue and subscription view. Start with scope, search, and date range, then refine if needed.')) . '</p>
          </div>
          <div class="form-actions">
            <a class="secondary compact-link" href="' . h(admin_redirect_url()) . '#admin-billing">' . h(t('Reinitialiser', 'Reset')) . '</a>
          </div>
        </div>
        <div class="stats-grid billing-summary-grid">
          ' . $summaryCards . '
        </div>
        ' . admin_billing_scope_nav($filters, count($subscriptions), count($payments)) . '
        <form class="log-filter-stack" method="get" action="/admin#admin-billing">
          ' . admin_key_input() . '
          <input type="hidden" name="billing_scope" value="' . h($scope) . '">
          <input type="hidden" name="billing_view" value="' . h($billingView) . '">
          <div class="admin-directory-form admin-billing-filters">
            <label class="span-2"><span>' . h(t('Client / recherche', 'Client / search')) . '</span><input type="search" name="billing_q" value="' . h($query) . '" placeholder="' . h(t('email, id, description', 'email, id, description')) . '"></label>
            ' . ($scope !== 'payments' ? '<label><span>' . h(t('Etat abonnement', 'Subscription status')) . '</span><select name="billing_subscription_status">' . admin_select_options($subscriptionStatusMap, $subscriptionStatus, t('Tous', 'All')) . '</select></label>' : '') . '
            ' . ($scope !== 'subscriptions' ? '<label><span>' . h(t('Etat paiement', 'Payment status')) . '</span><select name="billing_payment_status">' . admin_select_options($paymentStatusMap, $paymentStatus, t('Tous', 'All')) . '</select></label>' : '') . '
            <label><span>' . h(t('Date debut', 'Start date')) . '</span><input type="date" name="billing_date_from" value="' . h($dateFrom) . '"></label>
            <label><span>' . h(t('Date fin', 'End date')) . '</span><input type="date" name="billing_date_to" value="' . h($dateTo) . '"></label>
            <button type="submit">' . h(t('Appliquer', 'Apply')) . '</button>
          </div>
          <details class="log-filter-details"' . ($advancedFiltersOpen ? ' open' : '') . '>
            <summary>' . h(t('Filtres avances billing', 'Advanced billing filters')) . '</summary>
            <div class="admin-directory-form admin-billing-filters advanced">
              ' . ($scope !== 'payments' ? '<label><span>' . h(t('Plan', 'Plan')) . '</span><select name="billing_plan">' . admin_select_options($planMap, $plan, t('Tous', 'All')) . '</select></label>' : '') . '
              <label><span>Provider</span><select name="billing_provider">' . admin_select_options($providerMap, $provider, t('Tous', 'All')) . '</select></label>
              ' . ($scope !== 'subscriptions' ? '<label><span>' . h(t('Devise', 'Currency')) . '</span><select name="billing_currency">' . admin_select_options($currencyMap, $currency, t('Toutes', 'All')) . '</select></label>' : '') . '
              ' . ($scope !== 'subscriptions' ? '<label><span>' . h(t('Facture', 'Invoice')) . '</span><select name="billing_invoice">' . $invoiceHtml . '</select></label>' : '') . '
              ' . ($scope !== 'subscriptions' ? '<label><span>' . h(t('Montant min', 'Min amount')) . '</span><input type="number" name="billing_amount_min" min="0" step="0.01" value="' . h($amountMin) . '" placeholder="0.00"></label>' : '') . '
              ' . ($scope !== 'subscriptions' ? '<label><span>' . h(t('Montant max', 'Max amount')) . '</span><input type="number" name="billing_amount_max" min="0" step="0.01" value="' . h($amountMax) . '" placeholder="499.00"></label>' : '') . '
            </div>
          </details>
          ' . admin_billing_filter_summary($filters) . '
        </form>
      </section>
      <section class="panel">
        <div class="section-heading log-section-heading">
          <div>
            <h2>' . h(t('Details facturation', 'Billing details')) . '</h2>
            <p>' . h(t('La synthese reste visible en haut. Le detail se lit maintenant par sous-vue, pas en pile.', 'The summary stays visible at the top. Details are now read by sub-view, not as a long stacked page.')) . '</p>
          </div>
          <div class="section-heading-side">
            <div>' . admin_log_badge('neutral', (string) $detailCount) . '</div>
            ' . $detailHint . '
          </div>
        </div>
        ' . $contentNav . '
        <div class="billing-detail-panel">
          <div class="section-heading log-section-heading">
            <div><h3>' . h($detailTitle) . '</h3><p>' . h($detailDescription) . '</p></div>
          </div>
          ' . $detailTable . '
        </div>
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

function admin_export_status_label(string $status): string
{
    return match (strtolower(trim($status))) {
        'authorized' => t('Autorise', 'Authorized'),
        'consumed' => t('Consomme', 'Consumed'),
        'revoked' => t('Revoque', 'Revoked'),
        'expired' => t('Expire', 'Expired'),
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
        'all' => [t('Base complete', 'Full database'), t('Timeline CSV triee par date; Excel/JSON avec tables separees par domaine. Secrets et tokens ne sont pas exportes.', 'Date-sorted CSV timeline; Excel/JSON with separate tables by domain. Secrets and tokens are not exported.')],
        'clients' => [t('Clients', 'Clients'), t('Comptes, credits courants, statut et abonnement courant.', 'Accounts, current credits, status, and current subscription.')],
        'billing' => [t('Facturation', 'Billing'), t('Abonnements, paiements, factures et identifiants Stripe utiles.', 'Subscriptions, payments, invoices, and useful Stripe identifiers.')],
        'support' => ['Support', t('Tickets, messages et notifications email.', 'Tickets, messages, and email notifications.')],
        'credits' => [t('Credits', 'Credits'), t('Historique des mouvements de credits par client.', 'History of credit movements by client.')],
        'exports' => [t('Autorisations', 'Authorizations'), t('Demandes d exports, couts, et consommation.', 'Export requests, costs, and consumption.')],
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
            <h2>' . h(t('Exports base de donnees', 'Database exports')) . '</h2>
            <p>' . h(t('Choisis une portee metier puis un format. Les exports servent a sortir la base de travail, pas l historique detaille d usage.', 'Choose a business scope, then a format. Exports are for extracting the working database, not the detailed usage history.')) . '</p>
          </div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>' . h(t('Portees', 'Scopes')) . '</span><strong>' . count($scopes) . '</strong></div>
          <div class="stat"><span>' . h(t('Formats', 'Formats')) . '</span><strong>CSV / XLS / JSON</strong></div>
          <div class="stat"><span>' . h(t('Usage', 'Usage')) . '</span><strong>' . h(t('Base metier', 'Business data')) . '</strong></div>
          <div class="stat"><span>' . h(t('Securite', 'Security')) . '</span><strong>' . h(t('Secrets exclus', 'Secrets excluded')) . '</strong></div>
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
        'application' => t('Application', 'Application'),
        'audit' => t('Audit', 'Audit'),
        'stripe' => 'Stripe',
        default => t('Toutes les sources', 'All sources'),
    };
}

function admin_log_scope_nav(array $filters, array $counts): string
{
    $current = (string) ($filters['log_scope'] ?? 'all');
    $items = [
        'all' => [t('Toutes', 'All'), (int) (($counts['application'] ?? 0) + ($counts['audit'] ?? 0) + ($counts['stripe'] ?? 0))],
        'application' => [t('Application', 'Application'), (int) ($counts['application'] ?? 0)],
        'audit' => [t('Audit', 'Audit'), (int) ($counts['audit'] ?? 0)],
        'stripe' => ['Stripe', (int) ($counts['stripe'] ?? 0)],
    ];
    $links = '';
    foreach ($items as $scope => [$label, $count]) {
        $class = 'log-scope-link' . ($current === $scope ? ' active' : '');
        $links .= '<a class="' . $class . '" href="' . h(admin_log_filter_link(['log_scope' => $scope])) . '"><span>' . h($label) . '</span><strong>' . $count . '</strong></a>';
    }
    return '<nav class="log-scope-nav" aria-label="' . h(t('Sources de logs', 'Log sources')) . '">' . $links . '</nav>';
}

function admin_log_filter_summary(array $filters): string
{
    $chips = [];
    $map = [
        'log_level' => t('Niveau', 'Level'),
        'log_channel' => t('Source', 'Source'),
        'log_event' => t('Evenement', 'Event'),
        'log_q' => t('Recherche', 'Search'),
        'log_date_from' => t('Depuis', 'From'),
        'log_date_to' => t('Jusqu a', 'To'),
        'log_user_id' => t('Client', 'Client'),
        'log_http_status' => 'HTTP',
        'log_request_id' => t('Trace', 'Trace'),
        'log_actor_role' => t('Role', 'Role'),
        'log_action' => 'Action',
        'log_target_type' => t('Cible', 'Target'),
        'log_outcome' => t('Resultat', 'Outcome'),
        'log_stripe_status' => 'Stripe',
        'log_stripe_type' => t('Type Stripe', 'Stripe type'),
    ];
    foreach ($map as $key => $label) {
        $value = trim((string) ($filters[$key] ?? ''));
        if ($value !== '') {
            $display = match ($key) {
                'log_channel' => admin_log_channel_label($value),
                'log_event' => admin_log_event_label($value),
                'log_actor_role' => admin_actor_role_label($value),
                'log_action' => admin_audit_action_label($value),
                'log_target_type' => admin_target_type_label($value),
                'log_outcome' => admin_audit_outcome_label($value),
                'log_stripe_status' => admin_stripe_status_label($value),
                default => $value,
            };
            $chips[] = '<li class="filter-chip"><span>' . h($label) . '</span><strong>' . h($display) . '</strong></li>';
        }
    }
    if (!$chips) {
        return '<p class="section-hint">' . h(t('Aucun filtre avance actif. La vue montre les evenements les plus recents selon la source selectionnee.', 'No advanced filter is active. The view shows the most recent events for the selected source.')) . '</p>';
    }
    return '<ul class="filter-chip-list" aria-label="' . h(t('Filtres actifs', 'Active filters')) . '">' . implode('', $chips) . '</ul>';
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
    $appSql .= ' ORDER BY id DESC';
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
    $securitySql = 'SELECT id, created_at, level, channel, event_code, message, user_id, request_id, route, http_method, http_status, context_json FROM app_logs WHERE ' . implode(' AND ', $securityWhere) . ' ORDER BY id DESC';
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
    $auditSql .= ' ORDER BY id DESC';
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
    $stripeSql .= ' ORDER BY id DESC';
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
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td>' . admin_log_badge($tone, admin_log_level_label($level)) . '</td><td>' . admin_table_stack(admin_log_channel_label((string) $log['channel']), (string) $log['channel'], true) . '</td><td>' . admin_table_stack(admin_log_event_label((string) $log['event_code']), (string) $log['event_code'], true) . '</td><td>' . h(admin_log_text((string) $log['message'])) . '</td><td>' . h((string) ($log['user_id'] ?? '')) . '</td><td>' . h((string) ($log['http_status'] ?? '')) . '</td><td><code>' . h(admin_log_text((string) ($log['request_id'] ?? ''), 48)) . '</code></td><td><code>' . h(admin_log_text((string) ($log['context_json'] ?? ''), 160)) . '</code></td></tr>';
    }
    return $rows ?: '<tr><td colspan="9">' . h(t('Aucun log.', 'No log.')) . '</td></tr>';
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
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td>' . admin_table_stack(admin_actor_role_label((string) $log['actor_role']), (string) $log['actor_role'], true) . '</td><td>' . h((string) ($log['actor_user_id'] ?? '')) . '</td><td>' . admin_table_stack(admin_audit_action_label((string) $log['action']), (string) $log['action'], true) . '</td><td>' . admin_table_stack(admin_target_type_label((string) ($log['target_type'] ?? '')), (string) ($log['target_type'] ?? ''), true) . '</td><td>' . h((string) ($log['target_id'] ?? '')) . '</td><td>' . admin_log_badge($tone, admin_audit_outcome_label($outcome)) . '</td><td>' . h(admin_log_text((string) ($log['reason'] ?? ''), 120)) . '</td><td><code>' . h(admin_log_text((string) ($log['request_id'] ?? ''), 48)) . '</code></td><td><code>' . h(admin_log_text((string) ($log['metadata_json'] ?? ''), 180)) . '</code></td></tr>';
    }
    return $rows ?: '<tr><td colspan="10">' . h(t('Aucun audit.', 'No audit entry.')) . '</td></tr>';
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
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td><code>' . h((string) $log['stripe_event_id']) . '</code></td><td>' . admin_table_stack(admin_stripe_event_label((string) $log['event_type']), (string) $log['event_type'], true) . '</td><td>' . h((string) ($log['stripe_object_id'] ?? '')) . '</td><td>' . admin_log_badge($tone, admin_stripe_status_label($status)) . '</td><td>' . (int) $log['attempt_count'] . '</td><td><code>' . h(admin_log_text((string) ($log['payload_hash'] ?? ''), 48)) . '</code></td><td>' . h(admin_log_text((string) ($log['error_message'] ?? ''), 180)) . '</td></tr>';
    }
    return $rows ?: '<tr><td colspan="8">' . h(t('Aucun evenement Stripe.', 'No Stripe event.')) . '</td></tr>';
}

function render_admin_logs_panel(PDO $pdo): string
{
    $filters = admin_log_filters();
    $contextKeys = [
        'key',
        'log_scope',
        'log_level',
        'log_channel',
        'log_event',
        'log_q',
        'log_date_from',
        'log_date_to',
        'log_user_id',
        'log_http_status',
        'log_request_id',
        'log_actor_role',
        'log_action',
        'log_target_type',
        'log_outcome',
        'log_stripe_status',
        'log_stripe_type',
    ];
    $scope = (string) $filters['log_scope'];
    $logData = admin_log_datasets($pdo, $filters);
    $securityState = admin_table_state('logs_security_table', [
        'created_at' => 'date',
        'level' => 'string',
        'channel' => 'string',
        'event_code' => 'string',
        'message' => 'string',
        'user_id' => 'int',
        'http_status' => 'int',
        'request_id' => 'string',
        'context_json' => 'string',
    ], 'created_at');
    $appState = admin_table_state('logs_application_table', [
        'created_at' => 'date',
        'level' => 'string',
        'channel' => 'string',
        'event_code' => 'string',
        'message' => 'string',
        'user_id' => 'int',
        'http_status' => 'int',
        'request_id' => 'string',
        'context_json' => 'string',
    ], 'created_at');
    $auditState = admin_table_state('logs_audit_table', [
        'created_at' => 'date',
        'actor_role' => 'string',
        'actor_user_id' => 'int',
        'action' => 'string',
        'target_type' => 'string',
        'target_id' => 'string',
        'outcome' => 'string',
        'reason' => 'string',
        'request_id' => 'string',
        'metadata_json' => 'string',
    ], 'created_at');
    $stripeState = admin_table_state('logs_stripe_table', [
        'created_at' => 'date',
        'stripe_event_id' => 'string',
        'event_type' => 'string',
        'stripe_object_id' => 'string',
        'status' => 'string',
        'attempt_count' => 'int',
        'payload_hash' => 'string',
        'error_message' => 'string',
    ], 'created_at');
    $securityRows = render_app_log_rows(admin_apply_table_state($logData['security_rows'], $securityState, [
        'created_at' => 'date',
        'level' => 'string',
        'channel' => 'string',
        'event_code' => 'string',
        'message' => 'string',
        'user_id' => 'int',
        'http_status' => 'int',
        'request_id' => 'string',
        'context_json' => 'string',
    ]));
    $appRows = render_app_log_rows(admin_apply_table_state($logData['app_rows'], $appState, [
        'created_at' => 'date',
        'level' => 'string',
        'channel' => 'string',
        'event_code' => 'string',
        'message' => 'string',
        'user_id' => 'int',
        'http_status' => 'int',
        'request_id' => 'string',
        'context_json' => 'string',
    ]));
    $auditRows = render_audit_log_rows(admin_apply_table_state($logData['audit_rows'], $auditState, [
        'created_at' => 'date',
        'actor_role' => 'string',
        'actor_user_id' => 'int',
        'action' => 'string',
        'target_type' => 'string',
        'target_id' => 'string',
        'outcome' => 'string',
        'reason' => 'string',
        'request_id' => 'string',
        'metadata_json' => 'string',
    ]));
    $stripeRows = render_stripe_log_rows(admin_apply_table_state($logData['stripe_rows'], $stripeState, [
        'created_at' => 'date',
        'stripe_event_id' => 'string',
        'event_type' => 'string',
        'stripe_object_id' => 'string',
        'status' => 'string',
        'attempt_count' => 'int',
        'payload_hash' => 'string',
        'error_message' => 'string',
    ]));

    $counts = [
        'security' => count($logData['security_rows']),
        'application' => count($logData['app_rows']),
        'audit' => count($logData['audit_rows']),
        'stripe' => count($logData['stripe_rows']),
    ];

    $levelOptions = '<option value="">' . h(t('Tous', 'All')) . '</option>';
    foreach (LOG_LEVELS as $option) {
        $levelOptions .= '<option value="' . h($option) . '"' . ($filters['log_level'] === $option ? ' selected' : '') . '>' . h(admin_log_level_label($option)) . '</option>';
    }

    $outcomeOptions = '<option value="">' . h(t('Tous', 'All')) . '</option>';
    foreach (['success', 'failed', 'blocked'] as $option) {
        $outcomeOptions .= '<option value="' . h($option) . '"' . ($filters['log_outcome'] === $option ? ' selected' : '') . '>' . h(admin_audit_outcome_label($option)) . '</option>';
    }

    $stripeStatusOptions = '<option value="">' . h(t('Tous', 'All')) . '</option>';
    foreach (['received', 'processing', 'processed', 'failed', 'ignored'] as $option) {
        $stripeStatusOptions .= '<option value="' . h($option) . '"' . ($filters['log_stripe_status'] === $option ? ' selected' : '') . '>' . h(admin_stripe_status_label($option)) . '</option>';
    }

    $channelOptions = '<option value="">' . h(t('Tous', 'All')) . '</option>';
    $channelStmt = $pdo->query('SELECT DISTINCT channel FROM app_logs WHERE channel IS NOT NULL AND channel <> "" ORDER BY channel ASC LIMIT 30');
    foreach ($channelStmt->fetchAll(PDO::FETCH_COLUMN) as $option) {
        $channelOptions .= '<option value="' . h((string) $option) . '"' . ($filters['log_channel'] === (string) $option ? ' selected' : '') . '>' . h(admin_log_channel_label((string) $option)) . '</option>';
    }

    $actorRoleOptions = '<option value="">' . h(t('Tous', 'All')) . '</option>';
    $actorRoleStmt = $pdo->query('SELECT DISTINCT actor_role FROM audit_logs WHERE actor_role IS NOT NULL AND actor_role <> "" ORDER BY actor_role ASC LIMIT 20');
    foreach ($actorRoleStmt->fetchAll(PDO::FETCH_COLUMN) as $option) {
        $actorRoleOptions .= '<option value="' . h((string) $option) . '"' . ($filters['log_actor_role'] === (string) $option ? ' selected' : '') . '>' . h(admin_actor_role_label((string) $option)) . '</option>';
    }

    $targetTypeOptions = '<option value="">' . h(t('Toutes', 'All')) . '</option>';
    $targetTypeStmt = $pdo->query('SELECT DISTINCT target_type FROM audit_logs WHERE target_type IS NOT NULL AND target_type <> "" ORDER BY target_type ASC LIMIT 25');
    foreach ($targetTypeStmt->fetchAll(PDO::FETCH_COLUMN) as $option) {
        $targetTypeOptions .= '<option value="' . h((string) $option) . '"' . ($filters['log_target_type'] === (string) $option ? ' selected' : '') . '>' . h(admin_target_type_label((string) $option)) . '</option>';
    }

    $advancedFiltersOpen = false;
    foreach (['log_channel', 'log_event', 'log_user_id', 'log_http_status', 'log_request_id', 'log_actor_role', 'log_action', 'log_target_type', 'log_outcome', 'log_stripe_status', 'log_stripe_type'] as $key) {
        if (trim((string) ($filters[$key] ?? '')) !== '') {
            $advancedFiltersOpen = true;
            break;
        }
    }

    $appSections = '
      <div class="section-heading log-section-heading"><div><h3>' . h(t('Alertes', 'Alerts')) . '</h3><p>' . h(t('Evenements de securite, refus d acces et erreurs a prioriser.', 'Security events, access denials, and errors to prioritize.')) . '</p></div><div>' . admin_log_badge('warning', (string) $counts['security']) . '</div></div>
      ' . admin_table_controls_with_context('logs_security_table', $securityState, '#admin-logs', $counts['security'], t('alertes', 'alerts'), $contextKeys) . '
      <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'logs_security_table', 'created_at', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Niveau', 'Level'), 'logs_security_table', 'level', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Source', 'Source'), 'logs_security_table', 'channel', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Evenement', 'Event'), 'logs_security_table', 'event_code', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Message', 'Message'), 'logs_security_table', 'message', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Client', 'Client'), 'logs_security_table', 'user_id', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context('HTTP', 'logs_security_table', 'http_status', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Trace', 'Trace'), 'logs_security_table', 'request_id', $securityState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Contexte', 'Context'), 'logs_security_table', 'context_json', $securityState, '#admin-logs', $contextKeys) . '</th></tr></thead><tbody>' . $securityRows . '</tbody></table></div>
      <div class="section-heading log-section-heading"><div><h3>' . h(t('Application', 'Application')) . '</h3><p>' . h(t('Trace technique des API, auth, emails, exports et erreurs runtime.', 'Technical trace for APIs, auth, email, exports, and runtime errors.')) . '</p></div><div>' . admin_log_badge('info', (string) $counts['application']) . '</div></div>
      ' . admin_table_controls_with_context('logs_application_table', $appState, '#admin-logs', $counts['application'], t('logs', 'logs'), $contextKeys) . '
      <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'logs_application_table', 'created_at', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Niveau', 'Level'), 'logs_application_table', 'level', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Source', 'Source'), 'logs_application_table', 'channel', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Evenement', 'Event'), 'logs_application_table', 'event_code', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Message', 'Message'), 'logs_application_table', 'message', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Client', 'Client'), 'logs_application_table', 'user_id', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context('HTTP', 'logs_application_table', 'http_status', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Trace', 'Trace'), 'logs_application_table', 'request_id', $appState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Contexte', 'Context'), 'logs_application_table', 'context_json', $appState, '#admin-logs', $contextKeys) . '</th></tr></thead><tbody>' . $appRows . '</tbody></table></div>
    ';

    $auditSection = '
      <section class="panel">
        <div class="section-heading log-section-heading"><div><h2>' . h(t('Audit actions', 'Audit actions')) . '</h2><p>' . h(t('Qui a fait quoi, sur quelle cible, avec quel resultat.', 'Who did what, on which target, and with what outcome.')) . '</p></div><div>' . admin_log_badge('neutral', (string) $counts['audit']) . '</div></div>
        ' . admin_table_controls_with_context('logs_audit_table', $auditState, '#admin-logs', $counts['audit'], t('actions', 'actions'), $contextKeys) . '
        <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'logs_audit_table', 'created_at', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Role', 'Role'), 'logs_audit_table', 'actor_role', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Acteur', 'Actor'), 'logs_audit_table', 'actor_user_id', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Action', 'Action'), 'logs_audit_table', 'action', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Cible', 'Target'), 'logs_audit_table', 'target_type', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context('ID', 'logs_audit_table', 'target_id', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Resultat', 'Outcome'), 'logs_audit_table', 'outcome', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Raison', 'Reason'), 'logs_audit_table', 'reason', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Trace', 'Trace'), 'logs_audit_table', 'request_id', $auditState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Contexte', 'Context'), 'logs_audit_table', 'metadata_json', $auditState, '#admin-logs', $contextKeys) . '</th></tr></thead><tbody>' . $auditRows . '</tbody></table></div>
      </section>
    ';

    $stripeSection = '
      <section class="panel">
        <div class="section-heading log-section-heading"><div><h2>Stripe events</h2><p>' . h(t('Reception, traitement et echecs des webhooks et operations paiement.', 'Reception, processing, and failures for webhooks and payment operations.')) . '</p></div><div>' . admin_log_badge('neutral', (string) $counts['stripe']) . '</div></div>
        ' . admin_table_controls_with_context('logs_stripe_table', $stripeState, '#admin-logs', $counts['stripe'], t('events', 'events'), $contextKeys) . '
        <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context(t('Date', 'Date'), 'logs_stripe_table', 'created_at', $stripeState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context('Event ID', 'logs_stripe_table', 'stripe_event_id', $stripeState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Type', 'Type'), 'logs_stripe_table', 'event_type', $stripeState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Objet', 'Object'), 'logs_stripe_table', 'stripe_object_id', $stripeState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Statut', 'Status'), 'logs_stripe_table', 'status', $stripeState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Essais', 'Attempts'), 'logs_stripe_table', 'attempt_count', $stripeState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context('Payload hash', 'logs_stripe_table', 'payload_hash', $stripeState, '#admin-logs', $contextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Erreur', 'Error'), 'logs_stripe_table', 'error_message', $stripeState, '#admin-logs', $contextKeys) . '</th></tr></thead><tbody>' . $stripeRows . '</tbody></table></div>
      </section>
    ';

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>' . h(t('Logs applicatifs', 'Application logs')) . '</h2>
            <p>' . h(t('Evenements techniques, securite, audit, Stripe et client. Les IP/courriels sensibles sont hashes.', 'Technical, security, audit, Stripe, and client events. Sensitive IPs/emails are hashed.')) . '</p>
          </div>
          <div class="form-actions">
            ' . admin_log_export_links() . '
            <a class="secondary compact-link" href="' . h(admin_log_filter_link()) . '">' . h(t('Reinitialiser filtres', 'Reset filters')) . '</a>
          </div>
        </div>
        <div class="stats-grid billing-summary-grid">
          <div class="stat"><span>' . h(t('Alertes', 'Alerts')) . '</span><strong>' . $counts['security'] . '</strong></div>
          <div class="stat"><span>' . h(t('Application', 'Application')) . '</span><strong>' . $counts['application'] . '</strong></div>
          <div class="stat"><span>Audit</span><strong>' . $counts['audit'] . '</strong></div>
          <div class="stat"><span>Stripe</span><strong>' . $counts['stripe'] . '</strong></div>
        </div>
        ' . admin_log_scope_nav($filters, $counts) . '
        <form class="log-filter-stack" method="get" action="/admin#admin-logs">
          ' . admin_key_input() . '
          <input type="hidden" name="log_scope" value="' . h($scope) . '">
          <div class="admin-directory-form admin-log-filters">
          <label><span>' . h(t('Niveau', 'Level')) . '</span><select name="log_level">' . $levelOptions . '</select></label>
          <label class="span-2"><span>' . h(t('Recherche', 'Search')) . '</span><input type="search" name="log_q" value="' . h((string) $filters['log_q']) . '" placeholder="message, contexte, request_id, metadata"></label>
          <label><span>' . h(t('Date debut', 'Start date')) . '</span><input type="date" name="log_date_from" value="' . h((string) $filters['log_date_from']) . '"></label>
          <label><span>' . h(t('Date fin', 'End date')) . '</span><input type="date" name="log_date_to" value="' . h((string) $filters['log_date_to']) . '"></label>
          <button type="submit">' . h(t('Appliquer', 'Apply')) . '</button>
          </div>
          <details class="log-filter-details"' . ($advancedFiltersOpen ? ' open' : '') . '>
            <summary>' . h(t('Filtres avances pour', 'Advanced filters for')) . ' ' . h(strtolower(admin_log_scope_label($scope))) . '</summary>
            <div class="admin-directory-form admin-log-filters advanced">
          <label><span>' . h(t('Source', 'Source')) . '</span><select name="log_channel">' . $channelOptions . '</select></label>
          <label><span>' . h(t('Evenement', 'Event')) . '</span><input type="search" name="log_event" value="' . h((string) $filters['log_event']) . '" placeholder="' . h(t('Connexion, limite, ticket...', 'login, limit, ticket...')) . '"></label>
          <label><span>' . h(t('Client ID', 'Client ID')) . '</span><input type="number" min="1" name="log_user_id" value="' . h((string) $filters['log_user_id']) . '" placeholder="8"></label>
          <label><span>' . h(t('Statut HTTP', 'HTTP status')) . '</span><input type="number" min="100" max="599" name="log_http_status" value="' . h((string) $filters['log_http_status']) . '" placeholder="403"></label>
          <label><span>' . h(t('Trace', 'Trace')) . '</span><input type="search" name="log_request_id" value="' . h((string) $filters['log_request_id']) . '" placeholder="' . h(t('trace ou fragment', 'trace or fragment')) . '"></label>
          <label><span>' . h(t('Role audit', 'Audit role')) . '</span><select name="log_actor_role">' . $actorRoleOptions . '</select></label>
          <label><span>' . h(t('Action audit', 'Audit action')) . '</span><input type="search" name="log_action" value="' . h((string) $filters['log_action']) . '" placeholder="' . h(t('profil, export, reglages...', 'profile, export, settings...')) . '"></label>
          <label><span>' . h(t('Cible audit', 'Audit target')) . '</span><select name="log_target_type">' . $targetTypeOptions . '</select></label>
          <label><span>' . h(t('Resultat audit', 'Audit outcome')) . '</span><select name="log_outcome">' . $outcomeOptions . '</select></label>
          <label><span>' . h(t('Statut Stripe', 'Stripe status')) . '</span><select name="log_stripe_status">' . $stripeStatusOptions . '</select></label>
          <label><span>' . h(t('Type Stripe', 'Stripe type')) . '</span><input type="search" name="log_stripe_type" value="' . h((string) $filters['log_stripe_type']) . '" placeholder="invoice, checkout, subscription"></label>
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
            <p class="eyebrow">' . h(t('Back-office', 'Back office')) . '</p>
            <h1>' . h(t('Admin protege', 'Protected admin')) . '</h1>
            <p>' . h(t('Configure `NICHOIR_ADMIN_KEY` cote serveur et ouvre `/admin?key=...` pour acceder au back-office.', 'Configure `NICHOIR_ADMIN_KEY` server-side and open `/admin?key=...` to access the back office.')) . '</p>
          </section>
        ', '/admin', 403);
        return;
    }

    $pdo = db();
    $summary = admin_summary();
    $selected = selected_admin_user($pdo);
    $notice = trim((string) ($_GET['notice'] ?? ''));
    $exportsContextKeys = ['key'];
    $exportsTableState = admin_table_state('exports_recent_table', [
        'id' => 'int',
        'email' => 'string',
        'export_type' => 'string',
        'credit_cost' => 'int',
        'export_status' => 'string',
        'created_at' => 'date',
        'consumed_at' => 'date',
    ], 'created_at');
    $exports = $pdo->query('SELECT export_authorizations.id, users.id AS user_id, users.email, export_type, credit_cost, export_authorizations.status AS export_status, export_authorizations.created_at, consumed_at FROM export_authorizations JOIN users ON users.id = export_authorizations.user_id')->fetchAll();
    $exportTableRows = admin_apply_table_state($exports, $exportsTableState, [
        'id' => 'int',
        'email' => 'string',
        'export_type' => 'string',
        'credit_cost' => 'int',
        'export_status' => 'string',
        'created_at' => 'date',
        'consumed_at' => 'date',
    ]);

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
        $exportRows .= '<tr><td>' . (int) $export['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $export['email']) . '</a></td><td>' . admin_table_stack(admin_export_type_label((string) $export['export_type']), (string) $export['export_type'], true) . '</td><td>' . (int) $export['credit_cost'] . '</td><td>' . admin_log_badge(admin_export_status_tone($status), admin_export_status_label($status)) . '</td><td>' . h((string) $export['created_at']) . '</td><td>' . h((string) ($export['consumed_at'] ?: '-')) . '</td></tr>';
    }
    $exportRows = '';
    foreach ($exportTableRows as $export) {
        $clientHref = admin_client_modal_url((int) $export['user_id'], 'admin-exports', 'exports');
        $status = (string) $export['export_status'];
        $exportRows .= '<tr><td>' . (int) $export['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $export['email']) . '</a></td><td>' . admin_table_stack(admin_export_type_label((string) $export['export_type']), (string) $export['export_type'], true) . '</td><td>' . (int) $export['credit_cost'] . '</td><td>' . admin_log_badge(admin_export_status_tone($status), admin_export_status_label($status)) . '</td><td>' . h((string) $export['created_at']) . '</td><td>' . h((string) ($export['consumed_at'] ?: '-')) . '</td></tr>';
    }
    if ($exportRows === '') {
        $exportRows = '<tr><td colspan="7">' . h(t('Aucune autorisation.', 'No authorization.')) . '</td></tr>';
    }

    page_response('Admin', '
      <section class="page-title">
        <p class="eyebrow">' . h(t('Back-office', 'Back office')) . '</p>
        <h1>Admin</h1>
        <p>' . h(t('Vue dev minimale. En local, l admin est ouvert; en production, definir `NICHOIR_ADMIN_KEY`.', 'Minimal dev view. Locally, admin is open; in production, define `NICHOIR_ADMIN_KEY`.')) . '</p>
      </section>
      ' . ($notice !== '' ? '<p class="notice">' . h(admin_notice_label($notice)) . '</p>' : '') . '
      <section class="metrics">
        <div><span>' . h(t('Clients', 'Clients')) . '</span><strong>' . $summary['users'] . '</strong></div>
        <div><span>' . h(t('Credits totaux', 'Total credits')) . '</span><strong>' . $summary['credits'] . '</strong></div>
        <div><span>' . h(t('Exports demandes', 'Requested exports')) . '</span><strong>' . $summary['exports'] . '</strong></div>
        <a href="#admin-support" data-tab-target="admin-support"><span>' . h(t('Tickets ouverts', 'Open tickets')) . '</span><strong>' . $summary['tickets'] . '</strong></a>
        <div><span>' . h(t('Abonnements actifs', 'Active subscriptions')) . '</span><strong>' . $summary['subscriptions'] . '</strong></div>
        <div><span>' . h(t('Paiements recus', 'Received payments')) . '</span><strong>' . h(money_cents((int) $summary['payments'], 'cad')) . '</strong></div>
      </section>
      <nav class="tab-nav" data-tab-nav role="tablist" aria-label="' . h(t('Sections admin', 'Admin sections')) . '">
        <a role="tab" aria-selected="true" data-tab-target="admin-support" href="#admin-support">Support</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-clients" href="#admin-clients">' . h(t('Clients', 'Clients')) . '</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-billing" href="#admin-billing">' . h(t('Facturation', 'Billing')) . '</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-exports" href="#admin-exports">' . h(t('Exports', 'Exports')) . '</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-logs" href="#admin-logs">' . h(t('Journaux', 'Logs')) . '</a>
        <a role="tab" aria-selected="false" data-tab-target="admin-settings" href="#admin-settings">' . h(t('Reglages', 'Settings')) . '</a>
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
              <h2>' . h(t('Autorisations recentes', 'Recent authorizations')) . '</h2>
              <p>' . h(t('Historique court des autorisations d export, de leur consommation et des credits engages.', 'Short history of export authorizations, their consumption, and credits committed.')) . '</p>
            </div>
            <div>' . admin_log_badge('neutral', (string) count($exports)) . '</div>
          </div>
          <div class="stats-grid billing-summary-grid">
            <div class="stat"><span>' . h(t('Autorisees', 'Authorized')) . '</span><strong>' . $authorizedExportCount . '</strong></div>
            <div class="stat"><span>' . h(t('Consommees', 'Consumed')) . '</span><strong>' . $consumedExportCount . '</strong></div>
            <div class="stat"><span>' . h(t('Revoquees', 'Revoked')) . '</span><strong>' . $revokedExportCount . '</strong></div>
            <div class="stat"><span>' . h(t('Credits engages', 'Credits committed')) . '</span><strong>' . $exportCreditTotal . '</strong></div>
          </div>
          ' . admin_table_controls_with_context('exports_recent_table', $exportsTableState, '#admin-exports', count($exports), t('autorisations', 'authorizations'), $exportsContextKeys) . '
          <div class="table-wrap"><table><thead><tr><th>' . admin_table_header_link_with_context('ID', 'exports_recent_table', 'id', $exportsTableState, '#admin-exports', $exportsContextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Client', 'Client'), 'exports_recent_table', 'email', $exportsTableState, '#admin-exports', $exportsContextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Type', 'Type'), 'exports_recent_table', 'export_type', $exportsTableState, '#admin-exports', $exportsContextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Cout', 'Cost'), 'exports_recent_table', 'credit_cost', $exportsTableState, '#admin-exports', $exportsContextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Etat', 'Status'), 'exports_recent_table', 'export_status', $exportsTableState, '#admin-exports', $exportsContextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Cree', 'Created'), 'exports_recent_table', 'created_at', $exportsTableState, '#admin-exports', $exportsContextKeys) . '</th><th>' . admin_table_header_link_with_context(t('Consomme', 'Consumed'), 'exports_recent_table', 'consumed_at', $exportsTableState, '#admin-exports', $exportsContextKeys) . '</th></tr></thead><tbody>' . $exportRows . '</tbody></table></div>
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
