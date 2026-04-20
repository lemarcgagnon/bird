import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
// Import unique des CSS variables globales du module Nichoir (P2.2a).
// Les CSS Modules par composant consomment ces variables via var(--n-*).
// Import au niveau layout racine : disponibles pour toutes les routes.
import '@nichoir/ui/theme.css';
import { resolveTheme, THEME_COOKIE_NAME } from './theme-resolver.js';

export const metadata = {
  title: 'Nichoir Demo',
  description: 'Nichoir module — Next.js integration',
};

// RSC async : lit le cookie server-side avant de rendre `<html>`. Conséquence :
// toutes les routes enveloppées par ce layout deviennent dynamiques (ƒ) — le
// prerender static (○) n'est plus possible parce que la page dépend de la
// requête HTTP entrante. Trade-off explicitement accepté (P3 fix B2) : le
// gain est l'élimination du mismatch serveur/client sur `data-theme` (plus de
// suppressHydrationWarning, plus de script anti-FOUC, plus de FOUC tout court).
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.JSX.Element> {
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return (
    <html lang="fr" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
