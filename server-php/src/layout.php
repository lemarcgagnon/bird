<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/i18n.php';

function page_icon_svg(string $name): string
{
    $paths = [
        'home' => '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
        'pricing' => '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9 10.5c.8-.7 5-.9 5 1.2 0 2.4-5 1.1-5 3.1 0 1.8 3.6 1.8 5 .8"/>',
        'library' => '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 6a2 2 0 0 1 2-2h12"/><path d="M9 8h6M9 12h6"/>',
        'info' => '<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
        'mail' => '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
        'user' => '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.8-4 14.2-4 16 0"/>',
        'menu' => '<path d="M4 7h16M4 12h16M4 17h16"/>',
        'close' => '<path d="M6 6l12 12M18 6 6 18"/>',
        'cube' => '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
        'arrow' => '<path d="M5 12h14M13 6l6 6-6 6"/>',
    ];
    if (!isset($paths[$name])) {
        return '';
    }
    return '<svg class="site-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' . $paths[$name] . '</svg>';
}

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
        '/' => ['label' => page_t('nav_home', $lang), 'icon' => 'home'],
        '/pricing' => ['label' => page_t('nav_pricing', $lang), 'icon' => 'pricing'],
        '/library' => ['label' => page_t('nav_library', $lang), 'icon' => 'library'],
        '/about' => ['label' => page_t('nav_about', $lang), 'icon' => 'info'],
        '/contact' => ['label' => page_t('nav_contact', $lang), 'icon' => 'mail'],
        '/account' => ['label' => page_t('nav_account', $lang), 'icon' => 'user'],
    ];
    $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
    echo '<!doctype html><html lang="' . h($lang) . '"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . h($title) . ' - Nichoir</title>';
    echo '<link rel="alternate" hreflang="fr" href="' . h(page_path_with_lang($path, 'fr')) . '">';
    echo '<link rel="alternate" hreflang="en" href="' . h(page_path_with_lang($path, 'en')) . '">';
    echo '<link rel="alternate" hreflang="x-default" href="' . h(page_path_with_lang($path, 'fr')) . '">';
    echo '<link rel="icon" href="/favicon.svg" type="image/svg+xml">';
    echo '<link rel="stylesheet" href="/site.css?v=20260623-landing-redesign"></head><body>';
    echo '<header class="site-header" data-site-header><a class="brand" href="' . h(page_path_with_lang('/', $lang)) . '">Nichoir</a><button class="site-nav-toggle" type="button" aria-label="' . h(page_t('nav_menu', $lang)) . '" aria-controls="site-navigation" aria-expanded="false" data-site-nav-toggle><span class="site-nav-toggle-icon site-nav-toggle-menu">' . page_icon_svg('menu') . '</span><span class="site-nav-toggle-icon site-nav-toggle-close">' . page_icon_svg('close') . '</span><span class="site-nav-toggle-text">' . h(page_t('nav_menu', $lang)) . '</span></button><nav id="site-navigation" class="site-nav" aria-label="' . h(page_t('aria_main_navigation', $lang)) . '">';
    foreach ($nav as $href => $item) {
        $class = $active === $href ? ' class="active"' : '';
        echo '<a' . $class . ' href="' . h(page_path_with_lang($href, $lang)) . '">' . page_icon_svg($item['icon']) . '<span class="site-link-label">' . h($item['label']) . '</span></a>';
    }
    echo '<span class="lang-pair" aria-label="' . h(page_t('aria_language', $lang)) . '">';
    echo '<a href="' . h(page_path_with_lang($path, 'fr')) . '"' . ($lang === 'fr' ? ' aria-current="true"' : '') . '>FR</a>';
    echo '<a href="' . h(page_path_with_lang($path, 'en')) . '"' . ($lang === 'en' ? ' aria-current="true"' : '') . '>EN</a>';
    echo '</span>';
    echo '<a class="button-link app-nav-link" href="' . $appUrl . '">' . page_icon_svg('cube') . '<span class="app-nav-link-copy"><span class="app-nav-link-badge">' . h(page_t('open_app_badge', $lang)) . '</span><span class="app-nav-link-label">' . h(page_t('open_app', $lang)) . '</span><span class="app-nav-link-hint">' . h(page_t('open_app_hint', $lang)) . '</span></span><span class="app-nav-link-arrow">' . page_icon_svg('arrow') . '</span></a>';
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
        const siteHeader = document.querySelector("[data-site-header]");
        const siteNavToggle = document.querySelector("[data-site-nav-toggle]");
        const siteNav = document.querySelector("#site-navigation");
        const compactNav = window.matchMedia("(max-width: 980px)");
        function setSiteNavOpen(open) {
          if (!siteHeader || !siteNavToggle) return;
          siteHeader.classList.toggle("is-nav-open", open);
          siteNavToggle.setAttribute("aria-expanded", open ? "true" : "false");
        }
        if (siteHeader && siteNavToggle && siteNav) {
          siteNavToggle.addEventListener("click", () => {
            setSiteNavOpen(!siteHeader.classList.contains("is-nav-open"));
          });
          siteNav.addEventListener("click", (event) => {
            if (compactNav.matches && event.target.closest("a")) {
              setSiteNavOpen(false);
            }
          });
          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setSiteNavOpen(false);
          });
          compactNav.addEventListener("change", (event) => {
            if (!event.matches) setSiteNavOpen(false);
          });
        }
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
