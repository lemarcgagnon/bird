# Plan Historique: Fixation Murale

Statut: archive. Ce document de plan ne decrit plus l'implementation actuelle.

## Pourquoi ce document est archive

- Il decrivait un ancien concept de bloc de fixation mural separe.
- L'implementation actuelle utilise un systeme universel male/femelle a queue d'aronde.
- Le support male est fusionne dans la maison exportee.
- La piece telechargeable exposee a l'utilisateur est le recepteur mural femelle (`export_wall_mount_receiver_stl`).
- Le ZIP panneaux n'ajoute pas de bloc de fixation mural separe.

## Etat actuel a retenir

- Option WASM/app: `wallMount`, desactivee par defaut.
- Geometrie actuelle: support male fusionne a l'arriere de la maison avec liaison profilee; recepteur femelle separe avec perçages traversants.
- Export utilisateur:
  - `export_house_stl`: inclut le support male fusionne quand `wallMount=true`.
  - `export_wall_mount_receiver_stl`: exporte le recepteur femelle seulement quand `wallMount=true`.
  - `export_panels_zip`: exporte les panneaux, pas un bloc de fixation mural separe.
- Export legacy:
  - `export_wall_mount_stl` existe encore dans le WASM comme helper technique/diagnostic, mais ce n'est pas le telechargement utilisateur de reference.

## Source de verite

- [wasm/README.md](/home/marc/Documents/nichoir16/wasm/README.md)
- [app/README.md](/home/marc/Documents/nichoir16/app/README.md)
- [server-php/README.md](/home/marc/Documents/nichoir16/server-php/README.md)

Si un nouveau redesign de fixation murale est planifie, partir de l'etat actuel du code et ouvrir un nouveau document de spec au lieu de reutiliser ce plan archive.
