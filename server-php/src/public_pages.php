<?php

declare(strict_types=1);

require_once __DIR__ . '/contact.php';
require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/library.php';
require_once __DIR__ . '/mail.php';

function render_landing_page(): void
{
    $lang = page_lang();
    $appUrl = h(dev_app_url($lang));
    page_response(page_t('home_title', $lang), '
	      <section class="hero marketing-hero">
	        <div>
	          <p class="eyebrow">' . h(page_t('home_eyebrow', $lang)) . '</p>
	          <h1>Nichoir</h1>
	          <p>' . h(page_t('home_body', $lang)) . '</p>
	          <div class="hero-actions">
	            <a class="primary" href="' . $appUrl . '">' . h(page_t('home_primary', $lang)) . '</a>
	            <a class="secondary" href="' . h(page_path_with_lang('/pricing', $lang)) . '">' . h(page_t('home_secondary', $lang)) . '</a>
	          </div>
	        </div>
	        <aside class="hero-card" aria-label="' . h(page_t('home_steps_title', $lang)) . '">
	          <span>' . h(page_t('home_kicker_one', $lang)) . '</span>
	          <span>' . h(page_t('home_kicker_two', $lang)) . '</span>
	          <span>' . h(page_t('home_kicker_three', $lang)) . '</span>
	        </aside>
	      </section>
	      <section class="grid">
	        <article><h2>' . h(page_t('home_card_wasm_title', $lang)) . '</h2><p>' . h(page_t('home_card_wasm_body', $lang)) . '</p></article>
	        <article><h2>' . h(page_t('home_card_credits_title', $lang)) . '</h2><p>' . h(page_t('home_card_credits_body', $lang)) . '</p></article>
	        <article><h2>' . h(page_t('home_card_fabrication_title', $lang)) . '</h2><p>' . h(page_t('home_card_fabrication_body', $lang)) . '</p></article>
	      </section>
	      <section class="panel feature-panel">
	        <div>
	          <p class="eyebrow">' . h(page_t('home_proof_title', $lang)) . '</p>
	          <h2>' . h(page_t('home_steps_title', $lang)) . '</h2>
	          <p>' . h(page_t('home_proof_body', $lang)) . '</p>
	        </div>
	        <ol class="step-list">
	          <li><strong>' . h(page_t('home_step_one_title', $lang)) . '</strong><span>' . h(page_t('home_step_one_body', $lang)) . '</span></li>
	          <li><strong>' . h(page_t('home_step_two_title', $lang)) . '</strong><span>' . h(page_t('home_step_two_body', $lang)) . '</span></li>
	          <li><strong>' . h(page_t('home_step_three_title', $lang)) . '</strong><span>' . h(page_t('home_step_three_body', $lang)) . '</span></li>
	        </ol>
	      </section>
	      <section class="hero closing-cta">
	        <p class="eyebrow">' . h(page_t('home_cta_title', $lang)) . '</p>
	        <p>' . h(page_t('home_cta_body', $lang)) . '</p>
	        <div class="hero-actions">
	          <a class="primary" href="' . $appUrl . '">' . h(page_t('home_primary', $lang)) . '</a>
	          <a class="secondary" href="' . h(page_path_with_lang('/pricing', $lang)) . '">' . h(page_t('home_secondary', $lang)) . '</a>
	        </div>
	      </section>
	    ', '/');
}

function render_pricing_page(): void
{
    $lang = page_lang();
    $creditPolicy = credit_policy_settings(db());
    page_response(page_t('pricing_title', $lang), '
	      <section class="page-title">
	        <p class="eyebrow">' . h(page_t('pricing_eyebrow', $lang)) . '</p>
	        <h1>' . h(page_t('pricing_title', $lang)) . '</h1>
	        <p>' . h(page_t('pricing_body', $lang)) . '</p>
	      </section>
	      <section class="pricing-grid">
	        <article class="pricing-card">
	          <span class="plan-badge">' . h(page_t('pricing_credits_label', $lang)) . '</span>
	          <h2>Credits</h2>
	          <strong>' . h(page_t('pricing_credits_price', $lang)) . '</strong>
	          <p>' . h(page_t('pricing_credits_body', $lang)) . '</p>
	          <ul>
	            <li>' . h(page_t('pricing_credits_feature_one', $lang)) . '</li>
	            <li>' . h(page_t('pricing_credits_feature_two', $lang)) . '</li>
	            <li>' . h(page_t('pricing_credits_feature_three', $lang)) . '</li>
	          </ul>
	          <a class="secondary" href="' . h(page_path_with_lang('/account#account-billing', $lang)) . '">' . h(page_t('pricing_cta', $lang)) . '</a>
	        </article>
	        <article class="pricing-card featured">
	          <span class="plan-badge">' . h(page_t('pricing_atelier_label', $lang)) . '</span>
	          <h2>Atelier</h2>
	          <strong>' . h(page_t('pricing_atelier_price', $lang)) . '</strong>
	          <p>' . h(page_t('pricing_atelier_body', $lang)) . '</p>
	          <ul>
	            <li>' . h(page_t('pricing_atelier_feature_one', $lang)) . '</li>
	            <li>' . h(page_t('pricing_atelier_feature_two', $lang)) . '</li>
	            <li>' . h(page_t('pricing_atelier_feature_three', $lang)) . '</li>
	          </ul>
	          <a class="primary" href="' . h(page_path_with_lang('/account#account-billing', $lang)) . '">' . h(page_t('pricing_cta', $lang)) . '</a>
	        </article>
	        <article class="pricing-card">
	          <span class="plan-badge">' . h(page_t('pricing_pro_label', $lang)) . '</span>
	          <h2>Pro</h2>
	          <strong>' . h(page_t('pricing_pro_price', $lang)) . '</strong>
	          <p>' . h(page_t('pricing_pro_body', $lang)) . '</p>
	          <ul>
	            <li>' . h(page_t('pricing_pro_feature_one', $lang)) . '</li>
	            <li>' . h(page_t('pricing_pro_feature_two', $lang)) . '</li>
	            <li>' . h(page_t('pricing_pro_feature_three', $lang)) . '</li>
	          </ul>
	          <a class="secondary" href="' . h(page_path_with_lang('/account#account-billing', $lang)) . '">' . h(page_t('pricing_cta', $lang)) . '</a>
	        </article>
	      </section>
	      <section class="panel pricing-rules">
	        <div>
	          <p class="eyebrow">' . h(page_t('current_dev_costs', $lang)) . '</p>
	          <h2>' . h(page_t('pricing_rule_title', $lang)) . '</h2>
	          <p>' . h(page_tv('current_dev_costs_body', ['cost' => (int) $creditPolicy['export_cost']], $lang)) . '</p>
	        </div>
	        <ul>
	          <li>' . h(page_tv('pricing_rule_one', ['cost' => (int) $creditPolicy['export_cost']], $lang)) . '</li>
	          <li>' . h(page_t('pricing_rule_two', $lang)) . '</li>
	          <li>' . h(page_t('pricing_rule_three', $lang)) . '</li>
	        </ul>
	      </section>
	    ', '/pricing');
}

function render_library_page(): void
{
    $lang = page_lang();
    $appUrl = h(dev_app_url($lang));
    $body = '
      <section class="page-title">
        <p class="eyebrow">' . h(page_t('library_eyebrow', $lang)) . '</p>
        <h1>' . h(page_t('library_title', $lang)) . '</h1>
        <p>' . h(page_t('library_body', $lang)) . '</p>
      </section>
      <section class="panel feature-panel library-flow">
        <div>
          <p class="eyebrow">' . h(page_t('library_flow_label', $lang)) . '</p>
          <h2>' . h(page_t('library_flow_title', $lang)) . '</h2>
          <p>' . h(page_t('library_flow_body', $lang)) . '</p>
        </div>
        <div class="hero-actions">
          <a class="primary" href="' . $appUrl . '">' . h(page_t('open_app', $lang)) . '</a>
          <a class="secondary" href="' . h(page_path_with_lang('/account', $lang)) . '">' . h(page_t('nav_account', $lang)) . '</a>
        </div>
      </section>
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>' . h(page_t('library_items_title', $lang)) . '</h2>
            <p>' . h(page_t('library_items_body', $lang)) . '</p>
          </div>
        </div>
        <p class="notice" data-library-message>' . h(page_t('library_loading', $lang)) . '</p>
        <div class="library-grid" data-library-grid></div>
      </section>
      <script>
        (() => {
          const prefix = "[nichoir library user]";
          const log = (message, details = {}) => console.log(prefix, message, details);
          const lang = ' . json_encode($lang) . ';
          const labels = lang === "en"
            ? {
                empty: "No library STL is available yet.",
                load_error: "Unable to load the library.",
                download: "Download STL",
                credits: "credits",
                cost: "Cost",
                size: "Size",
                downloads: "Downloads",
                authorize_error: "Download refused",
                insufficient: "Not enough credits. Open your account to add credits.",
                started: "Download started. Import the STL from your computer in the app decoration panel."
              }
            : {
                empty: "Aucun STL de librairie disponible pour le moment.",
                load_error: "Impossible de charger la librairie.",
                download: "Telecharger STL",
                credits: "credits",
                cost: "Cout",
                size: "Taille",
                downloads: "Telechargements",
                authorize_error: "Telechargement refuse",
                insufficient: "Credits insuffisants. Ouvre ton compte pour ajouter des credits.",
                started: "Telechargement lance. Importe ensuite le STL depuis ton ordinateur dans le panneau Decor de l app."
              };
          const grid = document.querySelector("[data-library-grid]");
          const message = document.querySelector("[data-library-message]");
          const esc = (value) => String(value ?? "").replace(/[&<>"\']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\'": "&#39;" }[ch]));
          const fmtBytes = (bytes) => {
            const value = Number(bytes || 0);
            if (value >= 1048576) return `${(value / 1048576).toFixed(1)} Mo`;
            if (value >= 1024) return `${Math.round(value / 1024)} Ko`;
            return `${value} o`;
          };
          async function api(path, options = {}) {
            const res = await fetch(path, {
              credentials: "same-origin",
              headers: { "Content-Type": "application/json", ...(options.headers || {}) },
              ...options
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || payload.ok === false) {
              const error = new Error(payload.error || res.statusText || "request_failed");
              error.status = res.status;
              error.payload = payload;
              throw error;
            }
            return payload;
          }
          async function load() {
            try {
              log("library_load_start");
              const payload = await api("/api/library");
              const items = payload.items || [];
              log("library_load_success", { count: items.length, items: items.map((item) => ({ id: item.id, type: item.media_type, cost: item.cost, name: item.original_filename })) });
              message.textContent = items.length ? "" : labels.empty;
              const previewHtml = (item) => {
                const label = esc(item.title || item.original_filename);
                return `<img class="library-thumbnail" src="${esc(item.thumbnail_url)}" alt="Preview ${label}" loading="lazy">`;
              };
              grid.innerHTML = items.map((item) => `
                <article class="library-card">
                  <div class="library-card-main">
                    ${previewHtml(item)}
                    <div class="library-card-copy">
                      <span class="plan-badge">${esc((item.media_type || item.file_ext || "file").toUpperCase())}</span>
                      <h3>${esc(item.title || item.original_filename)}</h3>
                      ${item.description ? `<p>${esc(item.description)}</p>` : ``}
                      <p>${esc(item.original_filename)}</p>
                    </div>
                  </div>
                  <div class="library-card-side">
                    <dl>
                      <div><dt>${labels.size}</dt><dd>${fmtBytes(item.file_size_bytes)}</dd></div>
                      <div><dt>${labels.downloads}</dt><dd>${esc(item.download_count)}</dd></div>
                      <div><dt>${labels.cost}</dt><dd>${esc(item.cost)} ${labels.credits}</dd></div>
                    </dl>
                    <button type="button" data-library-download="${esc(item.id)}">${labels.download}</button>
                  </div>
                </article>
              `).join("");
              log("library_previews_rendered", { count: items.length });
            } catch (err) {
              log("library_load_failed", { error: err.message || String(err) });
              message.textContent = labels.load_error;
            }
          }
          grid.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-library-download]");
            if (!button) return;
            button.disabled = true;
            try {
              log("download_authorize_start", { itemId: Number(button.dataset.libraryDownload || 0) });
              const payload = await api("/api/library/authorize", {
                method: "POST",
                body: JSON.stringify({ item_id: Number(button.dataset.libraryDownload || 0) })
              });
              log("download_authorize_success", { itemId: payload.item_id, cost: payload.cost, expires_at: payload.expires_at, admin: Boolean(payload.admin) });
              message.textContent = labels.started;
              log("download_redirect", { itemId: payload.item_id, download_url: payload.download_url });
              window.location.href = payload.download_url;
            } catch (err) {
              log("download_authorize_failed", { itemId: Number(button.dataset.libraryDownload || 0), status: err.status || 0, error: err.message || String(err) });
              message.textContent = err.status === 402 ? labels.insufficient : `${labels.authorize_error}: ${err.message}`;
            } finally {
              button.disabled = false;
            }
          });
          load();
        })();
      </script>
    ';
    page_response(page_t('library_title', $lang), $body, '/library');
}

function render_about_page(): void
{
    $lang = page_lang();
    page_response(page_t('about_title', $lang), '
      <section class="page-title about-hero">
        <div>
          <p class="eyebrow">' . h(page_t('about_eyebrow', $lang)) . '</p>
          <h1>' . h(page_t('about_title', $lang)) . '</h1>
          <p>' . h(page_t('about_body', $lang)) . '</p>
        </div>
        <a class="primary" href="' . h(dev_app_url($lang)) . '">' . h(page_t('home_primary', $lang)) . '</a>
      </section>
      <section class="grid about-grid">
        <article><h2>' . h(page_t('about_card_one_title', $lang)) . '</h2><p>' . h(page_t('about_card_one_body', $lang)) . '</p></article>
        <article><h2>' . h(page_t('about_card_two_title', $lang)) . '</h2><p>' . h(page_t('about_card_two_body', $lang)) . '</p></article>
        <article><h2>' . h(page_t('about_card_three_title', $lang)) . '</h2><p>' . h(page_t('about_card_three_body', $lang)) . '</p></article>
      </section>
      <section class="panel feature-panel">
        <div>
          <p class="eyebrow">' . h(page_t('about_principles_title', $lang)) . '</p>
          <h2>' . h(page_t('about_principles_title', $lang)) . '</h2>
        </div>
        <ol class="step-list">
          <li><strong>' . h(page_t('about_principle_one_title', $lang)) . '</strong><span>' . h(page_t('about_principle_one_body', $lang)) . '</span></li>
          <li><strong>' . h(page_t('about_principle_two_title', $lang)) . '</strong><span>' . h(page_t('about_principle_two_body', $lang)) . '</span></li>
          <li><strong>' . h(page_t('about_principle_three_title', $lang)) . '</strong><span>' . h(page_t('about_principle_three_body', $lang)) . '</span></li>
        </ol>
      </section>
      <section class="hero closing-cta">
        <p class="eyebrow">' . h(page_t('about_cta_title', $lang)) . '</p>
        <p>' . h(page_t('about_cta_body', $lang)) . '</p>
        <div class="hero-actions">
          <a class="primary" href="' . h(dev_app_url($lang)) . '">' . h(page_t('home_primary', $lang)) . '</a>
          <a class="secondary" href="' . h(page_path_with_lang('/pricing', $lang)) . '">' . h(page_t('home_secondary', $lang)) . '</a>
        </div>
      </section>
    ', '/about');
}

function render_contact_page(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        app_secure_session_start();
    }
    $lang = page_lang();
    $supportEmail = mail_settings(db())['support_email'];
    $errors = $_SESSION['contact_errors'] ?? [];
    $success = (bool) ($_SESSION['contact_success'] ?? false);
    $old = is_array($_SESSION['contact_old'] ?? null) ? $_SESSION['contact_old'] : [];
    unset($_SESSION['contact_errors'], $_SESSION['contact_success'], $_SESSION['contact_old']);
    $errorHtml = '';
    if (is_array($errors) && $errors !== []) {
        $items = '';
        foreach ($errors as $error) {
            $items .= '<li>' . h((string) $error) . '</li>';
        }
        $errorHtml = '<div class="notice bad" role="alert"><strong>' . h(page_t('contact_error_title', $lang)) . '</strong><ul>' . $items . '</ul></div>';
    }
    $successHtml = $success ? '<div class="notice" role="status">' . h(page_t('contact_success', $lang)) . '</div>' : '';
    page_response(page_t('contact_title', $lang), '
      <section class="page-title">
        <p class="eyebrow">' . h(page_t('contact_eyebrow', $lang)) . '</p>
        <h1>' . h(page_t('contact_title', $lang)) . '</h1>
        <p>' . h(page_t('contact_body', $lang)) . '</p>
      </section>
      <section class="grid">
        <article>
          <h2>' . h(page_t('contact_ticket_title', $lang)) . '</h2>
          <p>' . h(page_t('contact_ticket_body', $lang)) . '</p>
          <p class="card-action"><a class="primary" href="' . h(page_path_with_lang('/account#account-support', $lang)) . '">' . h(page_t('contact_ticket_cta', $lang)) . '</a></p>
        </article>
        <article>
          <h2>' . h(page_t('contact_email_title', $lang)) . '</h2>
          <p>' . h(page_t('contact_email_body', $lang)) . '</p>
          <p class="card-action"><a class="secondary" href="mailto:' . h((string) $supportEmail) . '">' . h(page_t('contact_email_cta', $lang)) . '</a></p>
        </article>
      </section>
      <section class="panel contact-form-panel">
        <div>
          <p class="eyebrow">' . h(page_t('contact_form_title', $lang)) . '</p>
          <h2>' . h(page_t('contact_form_title', $lang)) . '</h2>
          <p>' . h(page_t('contact_body', $lang)) . '</p>
        </div>
        <form class="client-form" method="post" action="' . h(page_path_with_lang('/contact', $lang)) . '">
          ' . $successHtml . $errorHtml . '
          <input type="hidden" name="csrf_token" value="' . h(contact_csrf_token()) . '">
          <label class="honeypot" aria-hidden="true"><span>Website</span><input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          <label><span>' . h(page_t('contact_name', $lang)) . '</span><input name="name" type="text" maxlength="120" value="' . h((string) ($old['name'] ?? '')) . '"></label>
          <label><span>' . h(page_t('email', $lang)) . '</span><input name="email" type="email" maxlength="254" required value="' . h((string) ($old['email'] ?? '')) . '"></label>
          <label><span>' . h(page_t('contact_subject', $lang)) . '</span><input name="subject" type="text" maxlength="140" required value="' . h((string) ($old['subject'] ?? '')) . '"></label>
          <label><span>' . h(page_t('contact_message', $lang)) . '</span><textarea name="message" maxlength="4000" required>' . h((string) ($old['message'] ?? '')) . '</textarea></label>
          <button type="submit">' . h(page_t('contact_send', $lang)) . '</button>
        </form>
      </section>
    ', '/contact');
}

function render_terms_page(): void
{
    $lang = page_lang();
    page_response(page_t('terms_title', $lang), '
      <section class="page-title legal-page">
        <p class="eyebrow">' . h(page_t('footer_terms', $lang)) . '</p>
        <h1>' . h(page_t('terms_title', $lang)) . '</h1>
        <p>' . h(page_t('terms_body', $lang)) . '</p>
      </section>
    ', '/terms');
}

function render_legal_page(): void
{
    $lang = page_lang();
    page_response(page_t('legal_title', $lang), '
      <section class="page-title legal-page">
        <p class="eyebrow">' . h(page_t('footer_legal', $lang)) . '</p>
        <h1>' . h(page_t('legal_title', $lang)) . '</h1>
        <p>' . h(page_t('legal_body', $lang)) . '</p>
      </section>
    ', '/legal');
}
