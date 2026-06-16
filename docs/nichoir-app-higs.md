# Plan HIG cible pour l'app Nichoir

Objectif: ameliorer l'ergonomie HIG de l'app WASM sans changer la logique metier, la securite, le PHP, Stripe, SMTP, la DB ou le packaging. Cette passe doit rester visuelle/interaction et comparer l'etat avant/apres.

## Perimetre

Inclure:

- `app/style.css`
- `app/app.js` seulement si necessaire pour interaction/focus/status
- `app/index.html` seulement si cache-buster ou balisage minimal requis
- `wasm/src/lib.rs` seulement pour le HTML genere, les libelles UI et la structure des panneaux

Exclure:

- PHP backend
- admin
- auth/session
- Stripe
- SMTP/contact
- DB/migrations
- script artifact cPanel
- logique d'export/credits sauf libelle ou placement UI
- refonte visuelle globale

## Etat HIG observe

Points solides:

- navigation principale stable: `DIM.`, `Decor`, `Calculs`, `Plan`, `Compte`
- controles adaptes aux donnees: sliders + champs numeriques, segments, checkboxes
- theme clair/sombre present et persistant
- app orientee outil, pas page marketing
- exports et credits restent verifies serveur

Problemes a traiter:

- cibles interactives trop petites sur plusieurs controles
- `DIM.` trop dense, surtout avec options avancees
- `Compte` ressemble a un onglet mais ouvre une modale
- exports `Plan` ont trop d'actions au meme poids visuel
- feedback export/erreur pas assez stable
- certains symboles sont peu comprehensibles sans contexte

## Garde-fous anti-derive

- Ne pas changer le modele 3D.
- Ne pas changer les valeurs par defaut.
- Ne pas changer le calcul des exports.
- Ne pas changer les regles de credits.
- Ne pas changer les endpoints.
- Ne pas changer la structure de production/cPanel.
- Ne pas ajouter de dependance.
- Garder Three.js local.
- Garder l'app utilisable sans reseau externe.
- Garder FR/EN sur les libelles publics.
- Conserver la densite d'un outil technique, mais mieux hierarchiser.

## Etape 0: baseline avant modification

Avant toute modification:

1. Verifier Git:

```bash
git status --short
```

2. Capturer les vues de reference:

```bash
chromium --headless --disable-gpu --no-sandbox --screenshot=/tmp/nichoir-hig-before-dim.png --window-size=1365,900 --virtual-time-budget=5000 http://127.0.0.1:8016/app/index.html?lang=fr
```

Captures manuelles ou automatisees a produire:

- `DIM.`
- `Decor`
- `Calculs`
- `Plan`
- `Compte`
- mobile/narrow viewport si possible
- dark mode et light mode si possible

3. Noter:

- cibles visuelles trop petites
- scroll apparent
- chevauchements
- textes tronques
- sections difficiles a scanner
- actions principales/secondaires confuses

## Etape 1: cibles interactives

But: rendre les controles plus confortables sans grossir toute l'app.

Actions:

- porter les tabs, choix segmentes, boutons compacts et boutons header vers des hauteurs proches de 40-44px
- garder les champs numeriques lisibles et stables
- verifier les focus visibles
- ne pas augmenter les cartes au point de perdre la densite de l'outil

Checklist:

- [ ] tabs cliquables confortablement
- [ ] boutons FR/EN et theme cliquables confortablement
- [ ] boutons export confortables
- [ ] inputs numeriques lisibles
- [ ] focus clavier visible
- [ ] aucun texte de bouton tronque de maniere incoherente

## Etape 2: `DIM.` et options avancees

But: reduire la charge cognitive sans cacher les controles essentiels.

Actions:

- conserver `Corps` visible en premier
- garder `Toiture` visible mais mieux separee
- rendre ou renforcer visuellement les groupes avances:
  - Materiau
  - Trous de suspension
  - Fixation murale
  - Porte/details optionnels
- eviter de melanger suspension de toit et fixation murale
- garder l'etat actuel des options pendant rerender

Checklist:

- [ ] `Corps` reste immediatement comprehensible
- [ ] `Fixation murale` est clairement differente de `Trous de suspension`
- [ ] les controles avances n'ecrasent pas les dimensions de base
- [ ] aucune option active ne disparait sans indication
- [ ] scroll conserve une structure logique

## Etape 3: `Decor`

But: rendre le flux decoration plus lineaire.

Actions:

- renforcer la sequence: cible panneau -> chargement fichier -> statut -> reglages
- rendre le statut fichier plus visible
- verifier l'accessibilite du bouton fichier
- eviter de montrer trop de reglages tant qu'aucun fichier n'est charge

Checklist:

- [ ] cible panneau claire
- [ ] bouton fichier identifiable
- [ ] statut fichier lisible
- [ ] aucun reglages inutilement agressif avant fichier
- [ ] `clip relief to panel shape` / `Clipper le relief au panneau` visible et coherent

## Etape 4: `Calculs`

But: separer resume et details de fabrication.

Actions:

- mettre les valeurs les plus importantes en haut sous forme de resume plus scannable
- garder les details d'angles/coupes en liste
- garder l'export PDF accessible
- ne pas modifier les calculs

Checklist:

- [ ] volume/surface/pieces visibles rapidement
- [ ] angles et coupes restent accessibles
- [ ] PDF calculs reste clair
- [ ] les valeurs longues ne chevauchent pas

## Etape 5: `Plan`

But: clarifier les actions principales et secondaires.

Actions:

- donner plus de poids aux actions principales:
  - ZIP panneaux
  - Plan PDF/SVG selon usage
- garder `.OBJ` et `.JSON` en diagnostic/avance
- verifier que le preview plan reste lisible
- garder tous les exports existants

Checklist:

- [ ] action principale visible
- [ ] diagnostics moins dominants
- [ ] preview plan ne casse pas le layout
- [ ] export house/door/panels toujours accessibles
- [ ] aucun changement de cout/export serveur

## Etape 6: `Compte`

But: corriger la rupture mentale "onglet qui ouvre une modale".

Options acceptables:

1. Garder en modale, mais rendre le bouton `Compte` visuellement distinct d'un onglet.
2. Transformer `Compte` en vrai panneau si changement simple.

Decision recommandee pour cette passe:

- garder la modale, mais differencier le bouton compte dans la barre:
  - style utilitaire
  - aria-label clair
  - ne pas donner exactement le meme statut visuel qu'un tab

Checklist:

- [ ] utilisateur comprend que `Compte` ouvre une fenetre
- [ ] focus initial dans la modale correct
- [ ] fermeture clavier `Escape`
- [ ] retour focus au bouton d'origine
- [ ] sections compte scannables
- [ ] message "serveur source de verite" moins technique visuellement

## Etape 7: feedback/status

But: rendre les messages d'export et d'erreur previsibles.

Actions:

- garder une zone de statut stable par panneau actif ou un emplacement coherent pres des exports
- ne pas exposer d'erreurs techniques brutes
- garder couleurs + texte, pas couleur seule

Checklist:

- [ ] success visible
- [ ] erreur visible
- [ ] warning visible
- [ ] pas de message qui deplace brutalement les controles
- [ ] pas de detail technique sensible

## Verification automatisable apres modification

Commandes:

```bash
cargo check
cargo test
wasm-pack build --target web
node --check app/app.js
node scripts/mesh-smoke.mjs
find server-php deployment -name '*.php' -exec php -l {} +
scripts/build-cpanel-artifact.sh /tmp/nichoir-hig-review-20260616
find /tmp/nichoir-hig-review-20260616 \( -iname 'README*' -o -iname '*.md' -o -path '*/docs/*' -o -path '*/.git/*' -o -name '.env' -o -iname '*.sqlite' -o -iname '*.db' -o -name 'production.php' \) -print
rg -n "https://cdnjs|cdnjs|cloudflare|quick-login|quick login|compte test|demo account|password123|sk_live|sk_test|whsec_" /tmp/nichoir-hig-review-20260616/public_html/app /tmp/nichoir-hig-review-20260616/public_html/wasm
```

Attendu:

- toutes les commandes passent
- scans artifact sans sortie problematique
- `health` production sans config reste `500 configuration_error`
- app charge `app.js`, Three.js local, `wasm.js`, `wasm_bg.wasm`

## Verification visuelle apres modification

Captures apres:

- `/tmp/nichoir-hig-after-dim.png`
- `/tmp/nichoir-hig-after-decor.png`
- `/tmp/nichoir-hig-after-calcs.png`
- `/tmp/nichoir-hig-after-plan.png`
- `/tmp/nichoir-hig-after-account.png`
- mobile/narrow si possible

Comparer avant/apres:

- [ ] densite plus lisible
- [ ] aucune regression de contenu
- [ ] pas de chevauchement texte/controle
- [ ] pas de bouton coupe
- [ ] onglets comprehensibles
- [ ] compte ne se confond plus avec un panneau
- [ ] actions principales plus evidentes
- [ ] dark mode lisible
- [ ] light mode lisible

## Critere d'acceptation final

La passe HIG est acceptable si:

- seules les surfaces app/WASM/doc sont modifiees
- aucun comportement metier n'est change
- les tests automatises passent
- les captures apres montrent une hierarchie plus claire
- l'app reste dense et productive
- le statut Git est clean apres commit

Commit recommande:

```bash
git commit -m "Improve Nichoir app HIG usability"
```
