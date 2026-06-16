<?php

declare(strict_types=1);

require_once __DIR__ . '/contact.php';
require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/layout.php';
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
