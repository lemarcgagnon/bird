// Déclaration TS pour les imports CSS Modules.
// Chaque `*.module.css` est résolu comme `{ [className: string]: string }`.
// Le bundler (vite/vitest, Next.js webpack) se charge de la transformation réelle.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
