export type ExportKind =
  | 'stl-house'
  | 'stl-door'
  | 'stl-zip'
  | 'plan-png'
  | 'plan-svg';

export interface CreditGate {
  /** Vérifie si l'utilisateur peut consommer un crédit pour cette action.
   *  Peut interroger un backend. Retourne `true` si autorisé. */
  canExport(kind: ExportKind): Promise<boolean>;

  /** Notifie la consommation effective d'un crédit après succès.
   *  Utilisé pour décrémenter le solde et loguer l'audit. */
  onExportConsumed(kind: ExportKind, bytes: number): Promise<void>;
}
