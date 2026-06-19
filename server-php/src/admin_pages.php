<?php

declare(strict_types=1);

require_once __DIR__ . '/admin_actions.php';
require_once __DIR__ . '/library.php';
require_once __DIR__ . '/admin_core.php';
require_once __DIR__ . '/admin_exports.php';
require_once __DIR__ . '/admin_helpers.php';
require_once __DIR__ . '/credits.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/stripe.php';

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
        <form class="admin-create-form" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
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
    foreach ($params as $index => $value) {
        $stmt->bindValue($index + 1, $value);
    }
    $stmt->bindValue(count($params) + 1, $perPage, PDO::PARAM_INT);
    $stmt->bindValue(count($params) + 2, $offset, PDO::PARAM_INT);
    $stmt->execute();

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
        <form class="admin-directory-form" method="get" action="' . h(admin_base_path()) . '">
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
          <form class="span-all admin-profile-form" method="post" action="' . h(admin_base_path()) . '">
            ' . admin_csrf_input() . '
            <input type="hidden" name="action" value="update_user">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <input type="hidden" name="credits" value="' . (int) $user['credits'] . '">
            <label><span>Courriel</span><input type="email" name="email" value="' . h((string) $user['email']) . '" required></label>
            <label><span>Nom</span><input type="text" name="display_name" value="' . h((string) $user['display_name']) . '"></label>
            <label><span>Statut</span><select name="status">' . admin_status_options($status) . '</select></label>
            <button type="submit">Enregistrer profil</button>
          </form>
          <form method="post" action="' . h(admin_base_path()) . '">
            ' . admin_csrf_input() . '
            <input type="hidden" name="action" value="reset_password">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <label><span>Nouveau mot de passe</span><input type="password" name="password" minlength="8" required></label>
            <button type="submit">Reset mot de passe</button>
          </form>
          <form method="post" action="' . h(admin_base_path()) . '">
            ' . admin_csrf_input() . '
            <input type="hidden" name="action" value="set_status">
            <input type="hidden" name="user_id" value="' . $userId . '">
            <input type="hidden" name="status" value="' . h($nextStatus) . '">
            <button type="submit">' . h($nextLabel) . '</button>
          </form>
          <form class="span-all danger-form" method="post" action="' . h(admin_base_path()) . '">
            ' . admin_csrf_input() . '
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
        <form class="admin-directory-form" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
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
        <form class="admin-directory-form" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
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
    $exports = $pdo->prepare('SELECT app_id, export_type, credit_cost, status, created_at, consumed_at FROM export_authorizations WHERE user_id = ? ORDER BY id DESC LIMIT 50');
    $exports->execute([(int) $user['id']]);
    $rows = '';
    foreach ($exports->fetchAll() as $row) {
        $rows .= '<tr><td>' . h((string) $row['app_id']) . '</td><td>' . h((string) $row['export_type']) . '</td><td>' . (int) $row['credit_cost'] . '</td><td>' . h((string) $row['status']) . '</td><td>' . h((string) $row['created_at']) . '</td><td>' . h((string) ($row['consumed_at'] ?: '-')) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="6">Aucun export.</td></tr>';
    return '<section class="modal-section"><h3>Exports client</h3><div class="table-wrap"><table><thead><tr><th>App</th><th>Type</th><th>Cout</th><th>Etat</th><th>Cree</th><th>Consomme</th></tr></thead><tbody>' . $rows . '</tbody></table></div></section>';
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
        $tabButtons .= '<button id="tab-' . h($panel) . '" type="button"' . ($active ? ' class="active"' : '') . ' data-modal-tab="' . h($panel) . '" role="tab" aria-selected="' . ($active ? 'true' : 'false') . '" aria-controls="' . h($panel) . '">' . h($label) . '</button>';
    }
    return render_admin_modal_shell($title, $closeHash, '
      <nav class="modal-tab-nav" data-modal-tabs role="tablist" aria-label="Sections client">
        ' . $tabButtons . '
      </nav>
	      <div id="client-profile" data-modal-panel="client-profile" role="tabpanel" aria-labelledby="tab-client-profile"' . ($activePanel === 'client-profile' ? '' : ' hidden') . '>' . $profile . '</div>
	      <div id="client-credits" data-modal-panel="client-credits" role="tabpanel" aria-labelledby="tab-client-credits"' . ($activePanel === 'client-credits' ? '' : ' hidden') . '>' . $credits . '</div>
	      <div id="client-billing" data-modal-panel="client-billing" role="tabpanel" aria-labelledby="tab-client-billing"' . ($activePanel === 'client-billing' ? '' : ' hidden') . '>' . $billing . '</div>
	      <div id="client-exports" data-modal-panel="client-exports" role="tabpanel" aria-labelledby="tab-client-exports"' . ($activePanel === 'client-exports' ? '' : ' hidden') . '>' . $exports . '</div>
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
          <form method="post" action="' . h(admin_base_path()) . '">
            ' . admin_csrf_input() . '
            <input type="hidden" name="action" value="reply_ticket">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>Reponse support</span><textarea name="body" maxlength="5000" rows="4"' . $disabledReply . '></textarea></label>
            <button type="submit"' . $disabledReply . '>Envoyer reponse client</button>
          </form>
          <form method="post" action="' . h(admin_base_path()) . '">
            ' . admin_csrf_input() . '
            <input type="hidden" name="action" value="set_ticket_status">
            <input type="hidden" name="user_id" value="' . (int) $ticket['user_id'] . '">
            <input type="hidden" name="ticket_id" value="' . (int) $ticket['id'] . '">
            <label><span>Statut</span><select name="ticket_status">' . $statusOptions . '</select></label>
            <button type="submit">Fermer / reouvrir</button>
          </form>
          <form method="post" action="' . h(admin_base_path()) . '">
            ' . admin_csrf_input() . '
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
        $rows .= '<tr><td>' . (int) $row['id'] . '</td><td>#' . (int) $row['ticket_id'] . '</td><td>' . h((string) $row['recipient']) . '</td><td>' . h((string) $row['subject']) . '</td><td>' . h((string) $row['status']) . '</td><td>' . h(admin_error_summary((string) ($row['error'] ?? ''))) . '</td><td>' . h((string) ($row['sent_at'] ?: $row['created_at'])) . '</td></tr>';
    }
    $rows = $rows ?: '<tr><td colspan="7">Aucun email ticket.</td></tr>';
    $passwordNote = app_config_value('NICHOIR_SMTP_PASSWORD') !== '' ? 'Mot de passe fourni par configuration privee NICHOIR_SMTP_PASSWORD.' : 'Laisser vide pour conserver le mot de passe actuel.';

    return '
      <section class="panel">
        <h2>Email tickets</h2>
        <p>Configure ici le serveur email cPanel/SMTP utilise pour envoyer les notifications tickets. Les envois sont aussi journalises dans SQLite.</p>
        <form class="admin-email-form" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
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
        <form class="admin-email-test" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
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
        <form class="admin-stripe-form" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
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

function render_credit_policy_settings_panel(PDO $pdo): string
{
    $settings = credit_policy_settings($pdo);

    return '
      <section class="panel">
        <h2>Politique credits</h2>
        <p>Controle le cout d un telechargement premium et le bonus automatique pour les soldes partiels.</p>
        <form class="admin-credit-policy-form" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
          <input type="hidden" name="action" value="update_credit_policy_settings">
          <label><span>Credits consommes par telechargement</span><input type="number" name="export_credit_cost" min="1" step="1" value="' . (int) $settings['export_cost'] . '"></label>
          <label class="checkbox-label"><input type="checkbox" name="partial_credit_bonus_enabled" value="1"' . ($settings['partial_bonus_enabled'] ? ' checked' : '') . '> Bonus automatique si le client a un solde partiel positif inferieur au cout</label>
          <p class="control-note">Exemple actuel: cout 3. Un client avec 1 credit recoit 2 credits bonus, puis le telechargement debite 3 credits. Le ledger garde les deux mouvements.</p>
          <button type="submit">Enregistrer politique credits</button>
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
        <form class="admin-db-form" method="post" action="' . h(admin_base_path()) . '">
          ' . admin_csrf_input() . '
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
        'library' => ['Librairie', 'Fichiers STL de librairie, couts, activation et telechargements clients.'],
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

function render_admin_library_panel(PDO $pdo): string
{
    $items = library_list_items($pdo, false);
    $phpUploadLimits = library_ini_upload_limit_label();
    $itemRows = '';
    $imageCards = '';
    $stlCards = '';
    foreach ($items as $item) {
        $typeLabel = library_is_image_item($item) ? 'Image' : 'STL';
        if (library_is_image_item($item)) {
            $imageCards .= '
              <article class="library-preview-card">
                <img src="/api/library/preview?item_id=' . (int) $item['id'] . '" alt="' . h((string) ($item['title'] ?: $item['original_filename'])) . '" loading="lazy">
                <div>
                  <strong>' . h((string) ($item['title'] ?: $item['original_filename'])) . '</strong>
                  <span>' . h((string) $item['original_filename']) . '</span>
                </div>
              </article>
            ';
        } elseif (library_is_stl_item($item)) {
            $stlCards .= '
              <article class="library-preview-card library-stl-preview-card">
                <canvas width="260" height="260" data-admin-stl-preview="' . (int) $item['id'] . '" aria-label="Preview STL ' . h((string) ($item['title'] ?: $item['original_filename'])) . '"></canvas>
                <div>
                  <strong>' . h((string) ($item['title'] ?: $item['original_filename'])) . '</strong>
                  <span>' . h((string) $item['original_filename']) . '</span>
                </div>
              </article>
            ';
        }
        $itemRows .= '
          <tr>
            <td>#' . (int) $item['id'] . '</td>
            <td>' . h($typeLabel) . '</td>
            <td>
              <form class="inline-form library-item-form" method="post" action="' . h(admin_base_path()) . '">
                ' . admin_csrf_input() . '
                <input type="hidden" name="action" value="update_library_item">
                <input type="hidden" name="library_item_id" value="' . (int) $item['id'] . '">
                <label><span>Titre</span><input type="text" name="title" maxlength="140" value="' . h((string) $item['title']) . '"></label>
                <label><span>Cout</span><input type="number" name="cost" min="1" step="1" value="' . (int) $item['cost'] . '"></label>
                <label class="checkbox-label"><input type="checkbox" name="is_active" value="1"' . ((int) $item['is_active'] === 1 ? ' checked' : '') . '> Actif</label>
                <button type="submit">Enregistrer</button>
              </form>
              <p class="control-note">' . h((string) $item['original_filename']) . ' · ' . number_format(((int) $item['file_size_bytes']) / 1024, 0, ',', ' ') . ' Ko</p>
            </td>
            <td>' . (int) $item['download_count'] . '</td>
            <td>' . h((string) $item['updated_at']) . '</td>
          </tr>
        ';
    }
    if ($itemRows === '') {
        $itemRows = '<tr><td colspan="5">Aucun fichier dans la librairie.</td></tr>';
    }
    if ($imageCards === '') {
        $imageCards = '<p class="control-note">Aucune image uploadee pour le moment.</p>';
    }
    if ($stlCards === '') {
        $stlCards = '<p class="control-note">Aucun STL uploade pour le moment.</p>';
    }

    $downloads = $pdo->query(
        'SELECT library_downloads.id, library_downloads.downloaded_at, users.email, library_items.title, library_items.original_filename
         FROM library_downloads
         JOIN users ON users.id = library_downloads.user_id
         JOIN library_items ON library_items.id = library_downloads.library_item_id
         ORDER BY library_downloads.id DESC LIMIT 20'
    )->fetchAll();
    $downloadRows = '';
    foreach ($downloads as $download) {
        $downloadRows .= '<tr><td>#' . (int) $download['id'] . '</td><td>' . h((string) $download['email']) . '</td><td>' . h((string) ($download['title'] ?: $download['original_filename'])) . '</td><td>' . h((string) $download['downloaded_at']) . '</td></tr>';
    }
    if ($downloadRows === '') {
        $downloadRows = '<tr><td colspan="4">Aucun telechargement librairie.</td></tr>';
    }

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Librairie decors</h2>
            <p>Ajoute des fichiers STL ou images prives que les clients telechargent avec credits, puis importent localement dans le decor WASM.</p>
          </div>
        </div>
        <form class="admin-directory-form" method="post" action="' . h(admin_base_path()) . '" enctype="multipart/form-data" data-library-admin-upload-form>
          ' . admin_csrf_input() . '
          <input type="hidden" name="action" value="upload_library_item">
          <label><span>Fichiers STL ou images</span><input type="file" name="library_files[]" accept=".stl,.png,.jpg,.jpeg,.gif,.webp,model/stl,image/png,image/jpeg,image/gif,image/webp" multiple required></label>
          <label><span>Titre commun optionnel</span><input type="text" name="title" maxlength="140" placeholder="Laisse vide pour utiliser les noms de fichiers"></label>
          <label><span>Cout credits</span><input type="number" name="cost" min="1" step="1" value="1"></label>
          <label class="checkbox-label"><input type="checkbox" name="is_active" value="1" checked> Publier dans la librairie</label>
          <button type="submit">Ajouter fichiers</button>
        </form>
        <p class="control-note">Limites applicatives: 4 Mo par STL, 2 Mo par image PNG/JPEG/GIF/WEBP. Limites PHP actives: ' . h($phpUploadLimits) . '. Les fichiers restent dans <code>server-php/data/library</code>, hors racine publique.</p>
        <div class="library-preview-grid" data-library-admin-selected-preview></div>
        <p class="control-note" data-library-admin-debug>Aucun fichier selectionne.</p>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Type</th><th>Fichier</th><th>Telechargements</th><th>MAJ</th></tr></thead><tbody>' . $itemRows . '</tbody></table></div>
      </section>
      <section class="panel">
        <h2>Visualiseur STL</h2>
        <div class="library-preview-grid">' . $stlCards . '</div>
      </section>
      <section class="panel">
        <h2>Visualiseur images</h2>
        <div class="library-preview-grid">' . $imageCards . '</div>
      </section>
      <section class="panel">
        <h2>Telechargements librairie recents</h2>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Fichier</th><th>Date</th></tr></thead><tbody>' . $downloadRows . '</tbody></table></div>
      </section>
      <script>
        (() => {
          const prefix = "[nichoir library admin]";
          const log = (message, details = {}) => console.log(prefix, message, details);
          const warn = (message, details = {}) => console.warn(prefix, message, details);
          const params = new URLSearchParams(window.location.search);
          log("script_loaded", {
            hash: window.location.hash,
            notice: params.get("notice") || "",
            uploaded: params.get("uploaded") || "",
            failed: params.get("failed") || "",
            errors: params.get("errors") || "",
            php_limits: "' . h($phpUploadLimits) . '"
          });
          if (params.get("notice") === "library_upload_error") {
            warn("server_upload_refused", {
              failed: Number(params.get("failed") || 0),
              errors: params.get("errors") || "unknown_upload_error"
            });
          }
          const fmtBytes = (bytes) => {
            const value = Number(bytes || 0);
            if (value >= 1048576) return `${(value / 1048576).toFixed(1)} Mo`;
            if (value >= 1024) return `${Math.round(value / 1024)} Ko`;
            return `${value} o`;
          };
          function renderStlPreview(canvas, payload) {
            const ctx = canvas.getContext("2d");
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "#fffdf8";
            ctx.fillRect(0, 0, w, h);
            const triangles = payload.triangles || [];
            if (!triangles.length) {
              ctx.fillStyle = "#6e665b";
              ctx.fillText("Preview indisponible", 18, h / 2);
              return;
            }
            const pts = triangles.flat();
            const xs = pts.map((p) => p[0]);
            const ys = pts.map((p) => p[1]);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const scale = Math.min((w - 32) / Math.max(maxX - minX, 0.001), (h - 32) / Math.max(maxY - minY, 0.001));
            const map = (p) => [16 + (p[0] - minX) * scale, h - 16 - (p[1] - minY) * scale];
            ctx.lineWidth = 0.7;
            ctx.strokeStyle = "rgba(36,33,29,0.28)";
            ctx.fillStyle = "rgba(181,111,24,0.12)";
            triangles.forEach((tri) => {
              const a = map(tri[0]), b = map(tri[1]), c = map(tri[2]);
              ctx.beginPath();
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
              ctx.lineTo(c[0], c[1]);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            });
          }
          document.querySelectorAll("[data-admin-stl-preview]").forEach(async (canvas) => {
            const itemId = Number(canvas.dataset.adminStlPreview || 0);
            log("stl_preview_request", { itemId });
            try {
              const res = await fetch(`/api/library/stl-preview?item_id=${encodeURIComponent(itemId)}`, { credentials: "same-origin" });
              const payload = await res.json();
              if (!res.ok || payload.ok === false) throw new Error(payload.error || res.statusText);
              renderStlPreview(canvas, payload);
              log("stl_preview_loaded", { itemId, sampled_triangles: payload.sampled_triangles, bbox: payload.bbox });
            } catch (error) {
              log("stl_preview_failed", { itemId, error: error.message || String(error) });
            }
          });
          const form = document.querySelector("[data-library-admin-upload-form]");
          const input = form?.querySelector("input[type=file]");
          const selectedPreview = document.querySelector("[data-library-admin-selected-preview]");
          const debug = document.querySelector("[data-library-admin-debug]");
          const clearSelectedPreview = () => {
            selectedPreview?.querySelectorAll("img").forEach((img) => {
              if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
            });
            if (selectedPreview) selectedPreview.innerHTML = "";
          };
          function renderSelectedFiles() {
            const files = Array.from(input?.files || []);
            clearSelectedPreview();
            if (debug) {
              debug.textContent = files.length
                ? `${files.length} fichier(s) selectionne(s): ${files.map((file) => `${file.name} (${fmtBytes(file.size)})`).join(", ")}`
                : "Aucun fichier selectionne.";
            }
            if (!selectedPreview || !files.length) return;
            files.forEach((file) => {
              const card = document.createElement("article");
              card.className = "library-preview-card";
              if (file.type.startsWith("image/")) {
                const url = URL.createObjectURL(file);
                const img = document.createElement("img");
                img.src = url;
                img.alt = file.name;
                img.dataset.objectUrl = url;
                card.appendChild(img);
              } else {
                const canvas = document.createElement("canvas");
                canvas.width = 260;
                canvas.height = 260;
                canvas.className = "library-stl-canvas";
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#fffdf8";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#6e665b";
                ctx.font = "14px sans-serif";
                ctx.fillText("STL selectionne", 22, 120);
                ctx.fillText("Preview apres upload", 22, 145);
                card.appendChild(canvas);
              }
              const details = document.createElement("div");
              const name = document.createElement("strong");
              name.textContent = file.name;
              const meta = document.createElement("span");
              meta.textContent = `${file.type || "type inconnu"} · ${fmtBytes(file.size)}`;
              details.append(name, meta);
              card.appendChild(details);
              selectedPreview.appendChild(card);
            });
          }
          input?.addEventListener("change", () => {
            renderSelectedFiles();
            log("upload_files_selected", {
              count: input.files.length,
              files: Array.from(input.files).map((file) => ({ name: file.name, type: file.type, size: file.size }))
            });
          });
          form?.addEventListener("submit", () => {
            log("upload_submit", {
              count: input?.files.length || 0,
              cost: form.querySelector("[name=cost]")?.value,
              active: form.querySelector("[name=is_active]")?.checked
            });
          });
        })();
      </script>
    ';
}

function admin_log_text(string $value, int $limit = 220): string
{
    $value = trim($value);
    return strlen($value) > $limit ? substr($value, 0, $limit) . '...' : $value;
}

function admin_error_summary(string $value): string
{
    return trim($value) === '' ? '-' : 'Detail technique masque; voir logs serveur.';
}

function admin_app_log_message(array $log): string
{
    $channel = strtolower((string) ($log['channel'] ?? ''));
    $eventCode = strtolower((string) ($log['event_code'] ?? ''));
    $level = strtolower((string) ($log['level'] ?? ''));
    $technicalChannels = ['php', 'stripe', 'mail', 'smtp', 'email'];
    $technicalEvents = ['php_error', 'email_failed', 'stripe_webhook_failed', 'stripe_webhook_signature_failed'];
    $isTechnical = in_array($channel, $technicalChannels, true)
        || in_array($eventCode, $technicalEvents, true)
        || str_starts_with($eventCode, 'stripe_')
        || str_contains($eventCode, 'smtp')
        || str_contains($eventCode, 'email');

    if ($isTechnical && in_array($level, ['error', 'critical', 'warning'], true)) {
        return admin_error_summary((string) ($log['message'] ?? ''));
    }

    return admin_log_text((string) ($log['message'] ?? ''));
}

function admin_log_filter_link(array $params = []): string
{
    $base = [];
    $key = trim((string) ($_GET['key'] ?? ''));
    if ($key !== '') {
        $base['key'] = $key;
    }
    return admin_base_path() . ($base || $params ? '?' . http_build_query(array_merge($base, $params)) : '') . '#admin-logs';
}

function render_app_log_rows(array $logs): string
{
    $rows = '';
    foreach ($logs as $log) {
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td>' . h((string) $log['level']) . '</td><td>' . h((string) $log['channel']) . '</td><td>' . h((string) $log['event_code']) . '</td><td>' . h(admin_app_log_message($log)) . '</td><td>' . h((string) ($log['user_id'] ?? '')) . '</td><td>' . h((string) ($log['http_status'] ?? '')) . '</td><td><code>' . h((string) ($log['request_id'] ?? '')) . '</code></td></tr>';
    }
    return $rows ?: '<tr><td colspan="8">Aucun log.</td></tr>';
}

function render_audit_log_rows(array $logs): string
{
    $rows = '';
    foreach ($logs as $log) {
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td>' . h((string) $log['actor_role']) . '</td><td>' . h((string) ($log['actor_user_id'] ?? '')) . '</td><td>' . h((string) $log['action']) . '</td><td>' . h((string) ($log['target_type'] ?? '')) . '</td><td>' . h((string) ($log['target_id'] ?? '')) . '</td><td>' . h((string) $log['outcome']) . '</td><td><code>' . h(admin_log_text((string) ($log['metadata_json'] ?? ''), 180)) . '</code></td></tr>';
    }
    return $rows ?: '<tr><td colspan="8">Aucun audit.</td></tr>';
}

function render_stripe_log_rows(array $logs): string
{
    $rows = '';
    foreach ($logs as $log) {
        $rows .= '<tr><td>' . h((string) $log['created_at']) . '</td><td>' . h((string) $log['stripe_event_id']) . '</td><td>' . h((string) $log['event_type']) . '</td><td>' . h((string) ($log['stripe_object_id'] ?? '')) . '</td><td>' . h((string) $log['status']) . '</td><td>' . (int) $log['attempt_count'] . '</td><td>' . h(admin_error_summary((string) ($log['error_message'] ?? ''))) . '</td></tr>';
    }
    return $rows ?: '<tr><td colspan="7">Aucun evenement Stripe.</td></tr>';
}

function render_admin_logs_panel(PDO $pdo): string
{
    $level = trim((string) ($_GET['log_level'] ?? ''));
    $channel = trim((string) ($_GET['log_channel'] ?? ''));
    $event = trim((string) ($_GET['log_event'] ?? ''));
    $query = trim((string) ($_GET['log_q'] ?? ''));
    $where = [];
    $params = [];
    if ($level !== '' && in_array($level, LOG_LEVELS, true)) {
        $where[] = 'level = ?';
        $params[] = $level;
    }
    if ($channel !== '') {
        $where[] = 'channel = ?';
        $params[] = substr($channel, 0, 50);
    }
    if ($event !== '') {
        $where[] = 'event_code LIKE ?';
        $params[] = '%' . substr($event, 0, 100) . '%';
    }
    if ($query !== '') {
        $where[] = '(message LIKE ? OR request_id LIKE ?)';
        $term = '%' . substr($query, 0, 120) . '%';
        array_push($params, $term, $term);
    }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $appStmt = $pdo->prepare('SELECT created_at, level, channel, event_code, message, user_id, http_status, request_id FROM app_logs ' . $whereSql . ' ORDER BY id DESC LIMIT 80');
    $appStmt->execute($params);
    $appRows = render_app_log_rows($appStmt->fetchAll());

    $security = $pdo->query(
        "SELECT created_at, level, channel, event_code, message, user_id, http_status, request_id
         FROM app_logs
         WHERE level IN ('security', 'critical') OR event_code IN ('rate_limit_triggered', 'admin_access_denied', 'stripe_webhook_signature_failed', 'email_failed', 'php_error')
         ORDER BY id DESC LIMIT 60"
    )->fetchAll();
    $securityRows = render_app_log_rows($security);

    $audit = $pdo->query('SELECT created_at, actor_user_id, actor_role, action, target_type, target_id, outcome, metadata_json FROM audit_logs ORDER BY id DESC LIMIT 80')->fetchAll();
    $auditRows = render_audit_log_rows($audit);

    $stripe = $pdo->query('SELECT created_at, stripe_event_id, event_type, stripe_object_id, status, attempt_count, error_message FROM stripe_event_logs ORDER BY id DESC LIMIT 80')->fetchAll();
    $stripeRows = render_stripe_log_rows($stripe);

    $levelOptions = '<option value="">Tous</option>';
    foreach (LOG_LEVELS as $option) {
        $levelOptions .= '<option value="' . h($option) . '"' . ($level === $option ? ' selected' : '') . '>' . h($option) . '</option>';
    }

    return '
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Logs applicatifs</h2>
            <p>Evenements techniques, securite, audit, Stripe et client. Les IP/courriels sensibles sont hashes.</p>
          </div>
          <a class="secondary compact-link" href="' . h(admin_log_filter_link()) . '">Reinitialiser filtres</a>
        </div>
        <form class="admin-directory-form" method="get" action="' . h(admin_base_path()) . '#admin-logs">
          <label><span>Niveau</span><select name="log_level">' . $levelOptions . '</select></label>
          <label><span>Channel</span><input type="search" name="log_channel" value="' . h($channel) . '" placeholder="auth, api, stripe"></label>
          <label><span>Event</span><input type="search" name="log_event" value="' . h($event) . '" placeholder="login_failed"></label>
          <label><span>Recherche</span><input type="search" name="log_q" value="' . h($query) . '" placeholder="message, request_id"></label>
          <button type="submit">Filtrer</button>
        </form>
        <h3>Alertes</h3>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Niveau</th><th>Channel</th><th>Event</th><th>Message</th><th>User</th><th>HTTP</th><th>Request ID</th></tr></thead><tbody>' . $securityRows . '</tbody></table></div>
      </section>
      <section class="panel">
        <h2>Application</h2>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Niveau</th><th>Channel</th><th>Event</th><th>Message</th><th>User</th><th>HTTP</th><th>Request ID</th></tr></thead><tbody>' . $appRows . '</tbody></table></div>
      </section>
      <section class="panel">
        <h2>Audit actions</h2>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Role</th><th>Acteur</th><th>Action</th><th>Cible</th><th>ID</th><th>Issue</th><th>Meta</th></tr></thead><tbody>' . $auditRows . '</tbody></table></div>
      </section>
      <section class="panel">
        <h2>Stripe events</h2>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Event ID</th><th>Type</th><th>Objet</th><th>Statut</th><th>Essais</th><th>Erreur</th></tr></thead><tbody>' . $stripeRows . '</tbody></table></div>
      </section>
    ';
}

function render_admin_login_page(): void
{
    if (admin_allowed()) {
        header('Location: ' . admin_base_path());
        return;
    }
    $configured = admin_password_configured();
    $message = '';
    if (isset($_GET['error'])) {
        $message = '<p class="notice danger">Mot de passe admin invalide.</p>';
    } elseif (isset($_GET['logout'])) {
        $message = '<p class="notice">Session admin fermee.</p>';
    }
    $form = $configured
        ? '<form class="client-form" method="post" action="' . h(admin_login_path()) . '">
            ' . admin_csrf_input() . '
            <label><span>Mot de passe admin</span><input type="password" name="password" autocomplete="current-password" required autofocus></label>
            <button type="submit">Se connecter</button>
          </form>'
        : '<p>Configure `NICHOIR_ADMIN_PASSWORD_HASH` cote serveur avant d ouvrir le back-office.</p>';
    page_response('Admin', '
      <section class="page-title">
        <p class="eyebrow">Back-office</p>
        <h1>Connexion admin</h1>
        <p>Acces reserve aux administrateurs.</p>
      </section>
      <section class="panel account-panel">
        ' . $message . $form . '
      </section>
    ', admin_login_path(), $configured ? 200 : 503);
}

function admin_notice_message(string $notice): string
{
    if ($notice === 'library_uploaded') {
        $uploaded = max(0, (int) ($_GET['uploaded'] ?? 0));
        $failed = max(0, (int) ($_GET['failed'] ?? 0));
        $errors = trim((string) ($_GET['errors'] ?? ''));
        return 'Librairie mise a jour: ' . $uploaded . ' fichier(s) ajoute(s)' . ($failed > 0 ? ', ' . $failed . ' fichier(s) refuse(s)' : '') . ($errors !== '' ? ' Details: ' . $errors : '') . '.';
    }
    if ($notice === 'library_upload_error') {
        $failed = max(0, (int) ($_GET['failed'] ?? 0));
        $errors = trim((string) ($_GET['errors'] ?? ''));
        return 'Upload librairie refuse' . ($failed > 0 ? ' (' . $failed . ' fichier(s) refuse(s))' : '') . ($errors !== '' ? ': ' . $errors : '. Verifie le format, la taille ou la limite PHP upload_max_filesize/post_max_size.');
    }
    $messages = [
        'library_updated' => 'Fichier librairie mis a jour.',
        'library_update_error' => 'Mise a jour du fichier librairie refusee.',
        'library_item_invalid' => 'Fichier librairie invalide.',
    ];
    return $messages[$notice] ?? $notice;
}

function render_admin_page(): void
{
    if (!admin_allowed()) {
        if (function_exists('app_log')) {
            app_log(db(), 'security', 'admin', 'admin_access_denied', 'GET admin refuse', [], null, 403);
        }
        header('Location: ' . admin_login_path());
        return;
    }

    $pdo = db();
    $summary = admin_summary();
    $selected = selected_admin_user($pdo);
    $notice = trim((string) ($_GET['notice'] ?? ''));
    $exports = $pdo->query('SELECT export_authorizations.id, users.id AS user_id, users.email, app_id, export_type, credit_cost, export_authorizations.status AS export_status, export_authorizations.created_at, consumed_at FROM export_authorizations JOIN users ON users.id = export_authorizations.user_id ORDER BY export_authorizations.id DESC LIMIT 20')->fetchAll();
    $subscriptions = $pdo->query('SELECT subscriptions.id, users.id AS user_id, users.email, plan, subscriptions.status AS subscription_state, current_period_end, subscriptions.updated_at FROM subscriptions JOIN users ON users.id = subscriptions.user_id ORDER BY subscriptions.id DESC LIMIT 20')->fetchAll();
    $payments = $pdo->query('SELECT payments.id, users.id AS user_id, users.email, amount_cents, currency, payments.status AS payment_state, description, invoice_url, invoice_pdf, payments.created_at FROM payments JOIN users ON users.id = payments.user_id ORDER BY payments.id DESC LIMIT 20')->fetchAll();

    $exportRows = '';
    foreach ($exports as $export) {
        $clientHref = admin_client_modal_url((int) $export['user_id'], 'admin-exports', 'exports');
        $exportRows .= '<tr><td>' . (int) $export['id'] . '</td><td><a href="' . h($clientHref) . '">' . h((string) $export['email']) . '</a></td><td>' . h((string) $export['app_id']) . '</td><td>' . h((string) $export['export_type']) . '</td><td>' . (int) $export['credit_cost'] . '</td><td>' . h((string) $export['export_status']) . '</td><td>' . h((string) ($export['consumed_at'] ?: '-')) . '</td></tr>';
    }
    if ($exportRows === '') {
        $exportRows = '<tr><td colspan="7">Aucune autorisation.</td></tr>';
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
	        <p>Session admin active. Les actions sensibles exigent un jeton CSRF.</p>
	        <form class="inline-form" method="post" action="' . h(admin_logout_path()) . '">
	          ' . admin_csrf_input() . '
	          <button type="submit">Se deconnecter</button>
	        </form>
	      </section>
      ' . ($notice !== '' ? '<p class="notice">' . h(admin_notice_message($notice)) . '</p>' : '') . '
      <section class="metrics">
        <div><span>Clients</span><strong>' . $summary['users'] . '</strong></div>
        <div><span>Credits totaux</span><strong>' . $summary['credits'] . '</strong></div>
        <div><span>Exports demandes</span><strong>' . $summary['exports'] . '</strong></div>
        <a href="#admin-support" data-tab-target="admin-support"><span>Tickets ouverts</span><strong>' . $summary['tickets'] . '</strong></a>
        <div><span>Abonnements actifs</span><strong>' . $summary['subscriptions'] . '</strong></div>
        <div><span>Paiements recus</span><strong>' . h(money_cents((int) $summary['payments'], 'cad')) . '</strong></div>
      </section>
      <nav class="tab-nav" data-tab-nav role="tablist" aria-label="Sections admin">
        <a id="tab-admin-support" role="tab" aria-selected="true" aria-controls="admin-support" data-tab-target="admin-support" href="#admin-support">Support</a>
        <a id="tab-admin-clients" role="tab" aria-selected="false" aria-controls="admin-clients" data-tab-target="admin-clients" href="#admin-clients">Clients</a>
        <a id="tab-admin-library" role="tab" aria-selected="false" aria-controls="admin-library" data-tab-target="admin-library" href="#admin-library">Librairie</a>
        <a id="tab-admin-billing" role="tab" aria-selected="false" aria-controls="admin-billing" data-tab-target="admin-billing" href="#admin-billing">Billing</a>
        <a id="tab-admin-exports" role="tab" aria-selected="false" aria-controls="admin-exports" data-tab-target="admin-exports" href="#admin-exports">Exports</a>
        <a id="tab-admin-logs" role="tab" aria-selected="false" aria-controls="admin-logs" data-tab-target="admin-logs" href="#admin-logs">Logs</a>
        <a id="tab-admin-settings" role="tab" aria-selected="false" aria-controls="admin-settings" data-tab-target="admin-settings" href="#admin-settings">Reglages</a>
      </nav>
	      <section class="tab-panel" id="admin-support" data-tab-panel role="tabpanel" aria-labelledby="tab-admin-support">
        ' . render_admin_support_panel($pdo) . '
      </section>
	      <section class="tab-panel" id="admin-clients" data-tab-panel role="tabpanel" aria-labelledby="tab-admin-clients" hidden>
        ' . render_create_user_panel() . '
        ' . render_user_directory($pdo) . '
      </section>
	      <section class="tab-panel" id="admin-library" data-tab-panel role="tabpanel" aria-labelledby="tab-admin-library" hidden>
        ' . render_admin_library_panel($pdo) . '
      </section>
	      <section class="tab-panel" id="admin-billing" data-tab-panel role="tabpanel" aria-labelledby="tab-admin-billing" hidden>
        <section class="panel"><h2>Abonnements recents</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Plan</th><th>Etat</th><th>Fin periode</th><th>MAJ</th></tr></thead><tbody>' . $subscriptionRows . '</tbody></table></div></section>
        <section class="panel"><h2>Paiements recents</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>Montant</th><th>Etat</th><th>Description</th><th>Facture</th><th>Date</th></tr></thead><tbody>' . $paymentRows . '</tbody></table></div></section>
      </section>
	      <section class="tab-panel" id="admin-exports" data-tab-panel role="tabpanel" aria-labelledby="tab-admin-exports" hidden>
        ' . render_admin_database_export_panel() . '
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>Autorisations recentes</h2>
              <p>Telechargements autorises et consommation des credits.</p>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>ID</th><th>Client</th><th>App</th><th>Type</th><th>Cout</th><th>Etat</th><th>Consomme</th></tr></thead><tbody>' . $exportRows . '</tbody></table></div>
        </section>
      </section>
	      <section class="tab-panel" id="admin-logs" data-tab-panel role="tabpanel" aria-labelledby="tab-admin-logs" hidden>
        ' . render_admin_logs_panel($pdo) . '
      </section>
	      <section class="tab-panel" id="admin-settings" data-tab-panel role="tabpanel" aria-labelledby="tab-admin-settings" hidden>
        ' . render_database_settings_panel() . '
        ' . render_stripe_settings_panel($pdo) . '
        ' . render_credit_policy_settings_panel($pdo) . '
        ' . render_email_settings_panel($pdo) . '
      </section>
      ' . render_admin_modal($pdo, $selected) . '
    ', admin_base_path());
}
