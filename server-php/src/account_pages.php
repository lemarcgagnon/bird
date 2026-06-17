<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/stripe.php';

function render_account_page(): void
{
    $lang = page_lang();
    $clientI18n = json_encode([
        'not_connected' => page_t('not_connected', $lang),
        'none' => page_t('none', $lang),
        'account_load_prompt' => page_t('account_load_prompt', $lang),
        'no_movement' => page_t('no_movement', $lang),
        'no_payment' => page_t('no_payment', $lang),
        'no_ticket' => page_t('no_ticket', $lang),
        'no_message' => page_t('no_message', $lang),
        'view' => page_t('view', $lang),
        'open' => page_t('open', $lang),
        'close' => page_t('close', $lang),
        'reopen' => page_t('reopen', $lang),
        'loaded' => page_t('loaded', $lang),
        'invalid_session' => page_t('invalid_session', $lang),
        'ticket_missing' => page_t('ticket_missing', $lang),
        'login_denied' => page_t('login_denied', $lang),
        'register_sent' => page_t('register_sent', $lang),
        'register_denied' => page_t('register_denied', $lang),
        'account_activated' => page_t('account_activated', $lang),
        'activation_denied' => page_t('activation_denied', $lang),
        'resend_sent' => page_t('resend_sent', $lang),
        'resend_denied' => page_t('resend_denied', $lang),
        'profile_saved' => page_t('profile_saved', $lang),
        'profile_denied' => page_t('profile_denied', $lang),
        'checkout_redirect' => page_t('checkout_redirect', $lang),
        'checkout_denied' => page_t('checkout_denied', $lang),
        'portal_redirect' => page_t('portal_redirect', $lang),
        'portal_denied' => page_t('portal_denied', $lang),
        'ticket_denied' => page_t('ticket_denied', $lang),
        'reply_denied' => page_t('reply_denied', $lang),
        'status_denied' => page_t('status_denied', $lang),
        'status' => page_t('status', $lang),
        'priority' => page_t('priority', $lang),
        'updated' => page_t('updated', $lang),
        'support' => page_t('support', $lang),
        'client' => 'Client',
        'activation_unavailable' => page_t('activation_unavailable', $lang),
        'activation_failed' => page_t('activation_failed', $lang),
        'too_many_requests' => page_t('too_many_requests', $lang),
        'invalid_credentials' => page_t('invalid_credentials', $lang),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    page_response(page_t('account_title', $lang), '
	      <section class="page-title">
	        <p class="eyebrow">' . h(page_t('account_eyebrow', $lang)) . '</p>
	        <h1>' . h(page_t('account_title', $lang)) . '</h1>
	        <p>' . h(page_t('account_body', $lang)) . '</p>
	      </section>
	      <section class="panel account-panel">
	        <div class="stat"><span>' . h(page_t('status', $lang)) . '</span><strong data-account-state>' . h(page_t('not_connected', $lang)) . '</strong></div>
	        <div class="stat"><span>' . h(page_t('email', $lang)) . '</span><strong data-account-email>-</strong></div>
	        <div class="stat"><span>' . h(page_t('credits', $lang)) . '</span><strong data-account-credits>0</strong></div>
	        <div class="stat"><span>' . h(page_t('subscription', $lang)) . '</span><strong data-account-plan>' . h(page_t('none', $lang)) . '</strong></div>
	        <p data-account-message>' . h(page_t('account_load_prompt', $lang)) . '</p>
	      </section>
	      <nav class="tab-nav" data-tab-nav role="tablist" aria-label="' . h(page_t('account_sections', $lang)) . '">
		        <a id="tab-account-profile" role="tab" aria-selected="true" aria-controls="account-profile" data-tab-target="account-profile" href="#account-profile">' . h(page_t('profile', $lang)) . '</a>
		        <a id="tab-account-billing" role="tab" aria-selected="false" aria-controls="account-billing" data-tab-target="account-billing" href="#account-billing">' . h(page_t('billing', $lang)) . '</a>
		        <a id="tab-account-support" role="tab" aria-selected="false" aria-controls="account-support" data-tab-target="account-support" href="#account-support">' . h(page_t('support', $lang)) . '</a>
		        <a id="tab-account-app" role="tab" aria-selected="false" aria-controls="account-app" data-tab-target="account-app" href="#account-app">' . h(page_t('app', $lang)) . '</a>
	      </nav>

	      <section class="tab-panel" id="account-profile" data-tab-panel role="tabpanel" aria-labelledby="tab-account-profile">
        <section class="panel">
	          <h2>' . h(page_t('profile', $lang)) . '</h2>
	          <form class="client-form profile-form" data-profile-form>
	            <label><span>' . h(page_t('name', $lang)) . '</span><input name="display_name" type="text" maxlength="120"></label>
	            <label><span>' . h(page_t('email', $lang)) . '</span><input name="email" type="email" required></label>
	            <label><span>' . h(page_t('new_password', $lang)) . '</span><input name="password" type="password" minlength="8" maxlength="200" placeholder="' . h(page_t('keep_password', $lang)) . '"></label>
	            <button type="submit">' . h(page_t('save_profile', $lang)) . '</button>
	          </form>
        </section>

        <section class="account-grid">
        <div class="panel">
	          <h2>' . h(page_t('login', $lang)) . '</h2>
	          <form class="client-form" data-login-form>
		            <label><span>' . h(page_t('email', $lang)) . '</span><input name="email" type="email" autocomplete="username" required></label>
		            <label><span>' . h(page_t('password', $lang)) . '</span><input name="password" type="password" autocomplete="current-password" required></label>
	            <div class="form-actions">
	              <button type="submit">' . h(page_t('login', $lang)) . '</button>
	              <button type="button" data-logout>' . h(page_t('logout', $lang)) . '</button>
	            </div>
	          </form>
	        </div>
	        <div class="panel">
	          <h2>' . h(page_t('create_account', $lang)) . '</h2>
	          <form class="client-form" data-register-form>
	            <label><span>' . h(page_t('name', $lang)) . '</span><input name="display_name" type="text" maxlength="120"></label>
	            <label><span>' . h(page_t('email', $lang)) . '</span><input name="email" type="email" placeholder="client@example.com" required></label>
	            <label><span>' . h(page_t('password', $lang)) . '</span><input name="password" type="password" minlength="8" maxlength="200" required></label>
	            <button type="submit">' . h(page_t('create_account', $lang)) . '</button>
	          </form>
	        </div>
	        <div class="panel">
	          <h2>' . h(page_t('activation', $lang)) . '</h2>
	          <form class="client-form" data-activation-form>
	            <label><span>' . h(page_t('email', $lang)) . '</span><input name="email" type="email" placeholder="client@example.com" required></label>
	            <label><span>' . h(page_t('code', $lang)) . '</span><input name="code" type="text" inputmode="numeric" minlength="6" maxlength="6" autocomplete="one-time-code" required></label>
	            <div class="form-actions">
	              <button type="submit">' . h(page_t('activate', $lang)) . '</button>
	              <button type="button" data-resend-activation>' . h(page_t('resend_code', $lang)) . '</button>
	            </div>
	          </form>
        </div>
      </section>
      </section>

	      <section class="tab-panel" id="account-billing" data-tab-panel role="tabpanel" aria-labelledby="tab-account-billing" hidden>
        <section class="panel">
	          <h2>' . h(page_t('credit_history', $lang)) . '</h2>
	          <div class="table-wrap"><table><thead><tr><th>' . h(page_t('delta', $lang)) . '</th><th>' . h(page_t('reason', $lang)) . '</th><th>' . h(page_t('reference', $lang)) . '</th><th>' . h(page_t('date', $lang)) . '</th></tr></thead><tbody data-ledger-rows><tr><td colspan="4">' . h(page_t('not_connected', $lang)) . '.</td></tr></tbody></table></div>
        </section>

        <section class="account-grid">
        <div class="panel">
	          <h2>' . h(page_t('subscription', $lang)) . '</h2>
	          <div class="client-summary compact">
	            <div class="stat"><span>Plan</span><strong data-billing-plan>' . h(page_t('none', $lang)) . '</strong></div>
	            <div class="stat"><span>' . h(page_t('status', $lang)) . '</span><strong data-billing-status>' . h(page_t('none', $lang)) . '</strong></div>
	            <div class="stat"><span>' . h(page_t('period_end', $lang)) . '</span><strong data-billing-period>-</strong></div>
	          </div>
	        </div>
	        <div class="panel">
	          <h2>Stripe</h2>
	          <p>' . h(page_t('stripe_body', $lang)) . '</p>
          <div class="form-actions billing-actions">
            <button type="button" data-billing-offer="credits">Credits</button>
            <button type="button" data-billing-offer="atelier">Atelier</button>
            <button type="button" data-billing-offer="pro">Pro</button>
	            <button type="button" data-billing-portal>' . h(page_t('stripe_portal', $lang)) . '</button>
          </div>
          <p data-checkout-message></p>
        </div>
      </section>

        <section class="panel">
	          <h2>' . h(page_t('invoices_payments', $lang)) . '</h2>
	          <div class="table-wrap"><table><thead><tr><th>ID</th><th>' . h(page_t('amount', $lang)) . '</th><th>' . h(page_t('status', $lang)) . '</th><th>' . h(page_t('description', $lang)) . '</th><th>' . h(page_t('invoice', $lang)) . '</th><th>' . h(page_t('date', $lang)) . '</th></tr></thead><tbody data-payment-rows><tr><td colspan="6">' . h(page_t('not_connected', $lang)) . '.</td></tr></tbody></table></div>
        </section>
      </section>

	      <section class="tab-panel panel support-panel" id="account-support" data-tab-panel role="tabpanel" aria-labelledby="tab-account-support" hidden>
        <div class="section-heading">
          <div>
	            <p class="eyebrow">' . h(page_t('support', $lang)) . '</p>
	            <h2>' . h(page_t('tickets', $lang)) . '</h2>
	          </div>
	          <span class="section-hint">' . h(page_t('ticket_hint', $lang)) . '</span>
	        </div>
	        <div class="support-layout">
	          <form class="client-form ticket-form support-compose" data-ticket-form>
	            <h3>' . h(page_t('new_ticket', $lang)) . '</h3>
	            <label><span>' . h(page_t('subject', $lang)) . '</span><input name="subject" type="text" placeholder="' . h(page_t('ticket_subject_placeholder', $lang)) . '" maxlength="140" required></label>
	            <label><span>' . h(page_t('message', $lang)) . '</span><textarea name="body" rows="4" placeholder="' . h(page_t('ticket_message_placeholder', $lang)) . '" maxlength="5000" required></textarea></label>
	            <button type="submit">' . h(page_t('send_ticket', $lang)) . '</button>
	          </form>
	          <div class="support-inbox">
	            <h3>' . h(page_t('my_requests', $lang)) . '</h3>
	            <div class="table-wrap"><table><thead><tr><th>ID</th><th>' . h(page_t('subject', $lang)) . '</th><th>' . h(page_t('status', $lang)) . '</th><th>' . h(page_t('priority', $lang)) . '</th><th>' . h(page_t('updated', $lang)) . '</th><th></th></tr></thead><tbody data-ticket-rows><tr><td colspan="6">' . h(page_t('not_connected', $lang)) . '.</td></tr></tbody></table></div>
	            <div class="ticket-detail" data-ticket-detail hidden>
              <div class="ticket-detail-header">
                <div>
	                  <h3 data-ticket-title>' . h(page_t('ticket', $lang)) . '</h3>
	                  <p data-ticket-meta></p>
	                </div>
	                <button type="button" data-ticket-toggle-status>' . h(page_t('change_status', $lang)) . '</button>
	              </div>
	              <div class="ticket-thread" data-ticket-thread></div>
	              <form class="client-form ticket-form" data-ticket-reply-form>
	                <label><span>' . h(page_t('reply', $lang)) . '</span><textarea name="body" rows="3" maxlength="5000" required></textarea></label>
	                <button type="submit">' . h(page_t('reply_thread', $lang)) . '</button>
              </form>
            </div>
          </div>
        </div>
      </section>

	      <section class="tab-panel grid" id="account-app" data-tab-panel role="tabpanel" aria-labelledby="tab-account-app" hidden>
	        <article><h2>' . h(page_t('app', $lang)) . '</h2><p>' . h(page_t('app_exports_body', $lang)) . '</p></article>
	        <article><h2>' . h(page_t('master_server', $lang)) . '</h2><p>' . h(page_t('master_server_body', $lang)) . '</p></article>
	        <article><h2>Stripe</h2><p>' . h(page_t('stripe_webhook_body', $lang)) . '</p></article>
	      </section>

	      <script>
	      const I18N = ' . ($clientI18n ?: '{}') . ';
	      const LANG = "' . h($lang) . '";
	      const t = (key) => I18N[key] || key;
	      localStorage.removeItem("nichoir-auth-token");
	      let selectedTicketId = null;
	      let selectedTicket = null;
	      const setText = (selector, value) => document.querySelector(selector).textContent = value;
	      const esc = (value) => String(value ?? "").replace(/[&<>"\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\x27": "&#39;" }[c]));
	      const row = (cells) => `<tr>${cells.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`;
	      const locale = LANG === "en" ? "en-CA" : "fr-CA";
	      const fmtDate = (value) => {
	        if (!value) return "-";
	        const date = new Date(value);
	        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale);
	      };
	      const fmtMoney = (cents, currency) => new Intl.NumberFormat(locale, {
	        style: "currency",
	        currency: String(currency || "cad").toUpperCase(),
	      }).format(Number(cents || 0) / 100);

      async function api(path, options = {}) {
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        const res = await fetch(path, { credentials: "same-origin", ...options, headers });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || payload.ok === false) throw new Error(payload.error || `api_${res.status}`);
        return payload;
      }

      function renderLoggedOut(messageText = t("account_load_prompt")) {
        selectedTicketId = null;
        selectedTicket = null;
        setText("[data-account-state]", t("not_connected"));
        setText("[data-account-email]", "-");
        setText("[data-account-credits]", "0");
        setText("[data-account-plan]", t("none"));
        document.querySelector("[data-profile-form]").reset();
        setText("[data-billing-plan]", t("none"));
        setText("[data-billing-status]", t("none"));
        setText("[data-billing-period]", "-");
        document.querySelector("[data-ledger-rows]").innerHTML = `<tr><td colspan="4">${esc(t("not_connected"))}.</td></tr>`;
        document.querySelector("[data-payment-rows]").innerHTML = `<tr><td colspan="6">${esc(t("not_connected"))}.</td></tr>`;
        document.querySelector("[data-ticket-rows]").innerHTML = `<tr><td colspan="6">${esc(t("not_connected"))}.</td></tr>`;
        renderTicketDetail(null);
        document.querySelector("[data-account-message]").textContent = messageText;
      }

	      function readableError(error) {
	        const code = error?.message || String(error);
	        const labels = {
	          activation_unavailable: t("activation_unavailable"),
	          activation_failed: t("activation_failed"),
	          too_many_requests: t("too_many_requests"),
	          invalid_credentials: t("invalid_credentials"),
	        };
	        return labels[code] || code;
	      }

      async function loadAccount() {
        const message = document.querySelector("[data-account-message]");
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
	            ? ledger.ledger.map((item) => row([item.delta, item.reason, item.reference || "-", fmtDate(item.created_at)])).join("")
	            : `<tr><td colspan="4">${esc(t("no_movement"))}</td></tr>`;
          const billing = await api("/api/billing/summary");
          setText("[data-billing-plan]", billing.subscription.plan || "none");
          setText("[data-billing-status]", billing.subscription.status || "none");
          setText("[data-billing-period]", billing.subscription.current_period_end || "-");
	          document.querySelector("[data-payment-rows]").innerHTML = billing.payments.length
	            ? billing.payments.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(fmtMoney(item.amount_cents, item.currency))}</td><td>${esc(item.status)}</td><td>${esc(item.description || "-")}</td><td>${item.invoice_url ? `<a href="${esc(item.invoice_url)}" target="_blank" rel="noreferrer">${esc(t("view"))}</a>` : "-"} ${item.invoice_pdf ? `<a href="${esc(item.invoice_pdf)}" target="_blank" rel="noreferrer">PDF</a>` : ""}</td><td>${esc(fmtDate(item.created_at))}</td></tr>`).join("")
	            : `<tr><td colspan="6">${esc(t("no_payment"))}</td></tr>`;
          const tickets = await api("/api/tickets");
          renderTicketRows(tickets.tickets || []);
	          message.textContent = t("loaded");
	        } catch (err) {
	          renderLoggedOut(err.message === "unauthorized" ? t("account_load_prompt") : `${t("invalid_session")}: ${err.message || err}`);
	        }
      }

	      function renderTicketRows(tickets) {
	        document.querySelector("[data-ticket-rows]").innerHTML = tickets.length
	          ? tickets.map((item) => `<tr${Number(item.id) === Number(selectedTicketId) ? ` class="selected-row"` : ``}><td>#${esc(item.id)}</td><td>${esc(item.subject)}</td><td>${esc(item.status)}</td><td>${esc(item.priority || "normal")}</td><td>${esc(fmtDate(item.updated_at || item.created_at))}</td><td><button type="button" data-open-ticket="${esc(item.id)}">${esc(t("open"))}</button></td></tr>`).join("")
	          : `<tr><td colspan="6">${esc(t("no_ticket"))}</td></tr>`;
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
	        document.querySelector("[data-ticket-meta]").textContent = `${t("status")}: ${payload.ticket.status} · ${t("priority")}: ${payload.ticket.priority || "normal"} · ${t("updated")}: ${fmtDate(payload.ticket.updated_at)}`;
	        document.querySelector("[data-ticket-toggle-status]").textContent = payload.ticket.status === "open" ? t("close") : t("reopen");
        document.querySelector("[data-ticket-reply-form]").hidden = payload.ticket.status !== "open";
        document.querySelector("[data-ticket-thread]").innerHTML = (payload.messages || []).length
	          ? payload.messages.map((message) => `<article class="ticket-message ${esc(message.author_role || "client")}"><header><strong>${message.author_role === "admin" ? t("support") : t("client")}</strong><span>${esc(fmtDate(message.created_at))}</span></header><p>${esc(message.body).replace(/\\n/g, "<br>")}</p></article>`).join("")
	          : `<p>${esc(t("no_message"))}</p>`;
      }

      async function loadTicketDetail(ticketId) {
        if (!ticketId) return;
        selectedTicketId = ticketId;
	        try {
	          renderTicketDetail(await api(`/api/tickets/${ticketId}`));
	        } catch (err) {
	          document.querySelector("[data-account-message]").textContent = `${t("ticket_missing")}: ${err.message || err}`;
	        }
      }

      async function login(email, password) {
        const payload = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        await loadAccount();
      }

      document.querySelector("[data-login-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
	        try {
	          await login(data.get("email"), data.get("password"));
	        } catch (err) {
	          document.querySelector("[data-account-message]").textContent = `${t("login_denied")}: ${readableError(err)}`;
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
	          document.querySelector("[data-account-message]").textContent = t("register_sent");
	        } catch (err) {
	          document.querySelector("[data-account-message]").textContent = `${t("register_denied")}: ${readableError(err)}`;
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
          event.currentTarget.reset();
	          document.querySelector("[data-account-message]").textContent = t("account_activated");
	          await loadAccount();
	        } catch (err) {
	          document.querySelector("[data-account-message]").textContent = `${t("activation_denied")}: ${readableError(err)}`;
	        }
      });

      document.querySelector("[data-resend-activation]").addEventListener("click", async () => {
        const email = document.querySelector("[data-activation-form] [name=email]").value || document.querySelector("[data-register-form] [name=email]").value;
        try {
          await api("/api/auth/resend-activation", {
            method: "POST",
            body: JSON.stringify({ email }),
          });
	          document.querySelector("[data-account-message]").textContent = t("resend_sent");
	        } catch (err) {
	          document.querySelector("[data-account-message]").textContent = `${t("resend_denied")}: ${readableError(err)}`;
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
	          document.querySelector("[data-account-message]").textContent = t("profile_saved");
	          await loadAccount();
	        } catch (err) {
	          document.querySelector("[data-account-message]").textContent = `${t("profile_denied")}: ${err.message || err}`;
	        }
      });

      document.querySelectorAll("[data-billing-offer]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const payload = await api("/api/checkout/stripe-link", {
              method: "POST",
              body: JSON.stringify({ offer: button.dataset.billingOffer }),
            });
	            document.querySelector("[data-checkout-message]").textContent = `${t("checkout_redirect")} ${payload.offer}...`;
	            window.location.href = payload.checkout_url;
	          } catch (err) {
	            document.querySelector("[data-checkout-message]").textContent = `${t("checkout_denied")}: ${err.message || err}`;
	          }
        });
      });
      document.querySelector("[data-billing-portal]").addEventListener("click", async () => {
        try {
          const payload = await api("/api/billing/portal", { method: "POST" });
	          document.querySelector("[data-checkout-message]").textContent = t("portal_redirect");
	          window.location.href = payload.portal_url;
	        } catch (err) {
	          document.querySelector("[data-checkout-message]").textContent = `${t("portal_denied")}: ${err.message || err}`;
	        }
      });
      document.querySelector("[data-logout]").addEventListener("click", async () => {
        try { await api("/api/auth/logout", { method: "POST" }); } catch {}
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
	          document.querySelector("[data-account-message]").textContent = `${t("ticket_denied")}: ${err.message || err}`;
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
	          document.querySelector("[data-account-message]").textContent = `${t("reply_denied")}: ${err.message || err}`;
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
	          document.querySelector("[data-account-message]").textContent = `${t("status_denied")}: ${err.message || err}`;
	        }
      });

      loadAccount();
      </script>
    ', '/account');
}
