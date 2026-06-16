# Plan contact email PHP

Objectif: ajouter un formulaire de contact public qui envoie un email au support configure, sans transformer l application en relais SMTP ouvert.

## Portee

- Page concernee: `/contact`.
- Methode: `POST /contact`.
- Transport: reutiliser le client SMTP existant dans `server-php/src/mail.php`.
- Destinataire: uniquement `support_email` configure dans Admin > Reglages email.
- Format: email texte brut seulement.
- Pas de pieces jointes.
- Pas de destinataire libre fourni par l utilisateur.

## Champs

- `name`: optionnel, 120 caracteres max.
- `email`: requis, email valide, 254 caracteres max.
- `subject`: requis, 140 caracteres max.
- `message`: requis, 4000 caracteres max.
- `website`: honeypot, doit rester vide.
- `csrf_token`: requis.

## Protections

- CSRF par session PHP.
- Honeypot anti-bot.
- Rate limit par IP via le systeme existant d auth rate limiting.
- Validation stricte des longueurs.
- Email texte brut, avec echappement minimal par construction de chaines simples.
- Logs applicatifs: succes/echec avec hash email, pas de stockage complet du message.
- Si SMTP est desactive ou invalide, afficher un message explicite et conserver un lien mailto de secours.

## UX

- Le formulaire apparait sur `/contact`.
- Les utilisateurs connectes ou ayant un probleme compte/export sont orientes vers les tickets support.
- En cas de succes, afficher une confirmation courte.
- En cas d erreur, afficher une liste d erreurs actionnables.

## Validation

1. `php -l server-php/src/pages.php`.
2. `php -l server-php/public/index.php`.
3. GET `/contact?lang=fr` affiche le formulaire, le token CSRF et le honeypot cache.
4. POST sans token CSRF refuse l envoi.
5. POST avec honeypot rempli refuse l envoi sans envoyer d email.
6. POST avec email invalide refuse l envoi.
7. POST valide avec SMTP desactive affiche une erreur claire et ne plante pas.
8. POST valide avec SMTP configure envoie un email au `support_email`.
9. Plusieurs POST rapides depuis la meme IP finissent par declencher le rate limit.
10. Les logs ne contiennent pas le corps complet du message.
