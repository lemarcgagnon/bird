<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/i18n.php';

function page_response(string $title, string $body, string $active = '', int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $adminPath = function_exists('admin_base_path') ? admin_base_path() : '';
    $isAdmin = $adminPath !== '' && function_exists('admin_path_is_admin') && admin_path_is_admin($active);
    $adminPathForScript = $isAdmin ? $adminPath : '';
    $lang = $isAdmin ? 'fr' : page_lang();
    $appUrl = h(dev_app_url($lang));
    $nav = [
        '/' => page_t('nav_home', $lang),
        '/pricing' => page_t('nav_pricing', $lang),
        '/library' => page_t('nav_library', $lang),
        '/about' => page_t('nav_about', $lang),
        '/contact' => page_t('nav_contact', $lang),
        '/account' => page_t('nav_account', $lang),
    ];
    $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
    echo '<!doctype html><html lang="' . h($lang) . '"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . h($title) . ' - Nichoir</title>';
    echo '<link rel="alternate" hreflang="fr" href="' . h(page_path_with_lang($path, 'fr')) . '">';
    echo '<link rel="alternate" hreflang="en" href="' . h(page_path_with_lang($path, 'en')) . '">';
    echo '<link rel="alternate" hreflang="x-default" href="' . h(page_path_with_lang($path, 'fr')) . '">';
    echo '<link rel="icon" href="/favicon.svg" type="image/svg+xml">';
    echo '<link rel="stylesheet" href="/site.css?v=20260619-three-stl-preview"></head><body>';
    echo '<header class="site-header"><a class="brand" href="' . h(page_path_with_lang('/', $lang)) . '">Nichoir</a><nav class="site-nav" aria-label="' . h(page_t('aria_main_navigation', $lang)) . '">';
    foreach ($nav as $href => $label) {
        $class = $active === $href ? ' class="active"' : '';
        echo '<a' . $class . ' href="' . h(page_path_with_lang($href, $lang)) . '">' . h($label) . '</a>';
    }
    echo '<span class="lang-pair" aria-label="' . h(page_t('aria_language', $lang)) . '">';
    echo '<a href="' . h(page_path_with_lang($path, 'fr')) . '"' . ($lang === 'fr' ? ' aria-current="true"' : '') . '>FR</a>';
    echo '<a href="' . h(page_path_with_lang($path, 'en')) . '"' . ($lang === 'en' ? ' aria-current="true"' : '') . '>EN</a>';
    echo '</span>';
    echo '<a class="button-link" href="' . $appUrl . '">' . h(page_t('open_app', $lang)) . '</a>';
    echo '</nav></header>';
    echo '<main>' . $body . '</main>';
    echo '<footer class="site-footer">';
    echo '<div><a class="brand" href="' . h(page_path_with_lang('/', $lang)) . '">Nichoir</a><p>' . h(page_t('footer', $lang)) . '</p></div>';
    echo '<nav aria-label="' . h(page_t('footer_product', $lang)) . '"><strong>' . h(page_t('footer_product', $lang)) . '</strong><a href="' . h(page_path_with_lang('/pricing', $lang)) . '">' . h(page_t('nav_pricing', $lang)) . '</a><a href="' . h(page_path_with_lang('/library', $lang)) . '">' . h(page_t('nav_library', $lang)) . '</a><a href="' . h(dev_app_url($lang)) . '">' . h(page_t('open_app', $lang)) . '</a></nav>';
    echo '<nav aria-label="' . h(page_t('footer_support', $lang)) . '"><strong>' . h(page_t('footer_support', $lang)) . '</strong><a href="' . h(page_path_with_lang('/contact', $lang)) . '">' . h(page_t('nav_contact', $lang)) . '</a><a href="' . h(page_path_with_lang('/account#account-support', $lang)) . '">' . h(page_t('footer_ticket', $lang)) . '</a></nav>';
    echo '<nav aria-label="' . h(page_t('footer_company', $lang)) . '"><strong>' . h(page_t('footer_company', $lang)) . '</strong><a href="' . h(page_path_with_lang('/about', $lang)) . '">' . h(page_t('nav_about', $lang)) . '</a><a href="' . h(page_path_with_lang('/terms', $lang)) . '">' . h(page_t('footer_terms', $lang)) . '</a><a href="' . h(page_path_with_lang('/legal', $lang)) . '">' . h(page_t('footer_legal', $lang)) . '</a></nav>';
    echo '</footer>';
    echo '<script>
      (() => {
        const adminPath = ' . json_encode($adminPathForScript, JSON_UNESCAPED_SLASHES) . ';
        const tabNavs = document.querySelectorAll("[data-tab-nav]");
        if (!tabNavs.length) return;
        function activateTabs() {
          let hash = window.location.hash.replace("#", "");
          if (!hash && adminPath && window.location.pathname === adminPath) {
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
