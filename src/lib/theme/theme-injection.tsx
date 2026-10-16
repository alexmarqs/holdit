const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('holdit-theme');
  var dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

/** Runs before paint so the first frame is already light or dark. */
export function ThemeInjection() {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, runs before paint
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  );
}
