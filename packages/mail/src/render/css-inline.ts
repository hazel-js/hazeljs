/**
 * Minimal CSS inliner for compose-generated styles.
 * For production MJML/complex CSS, prefer the optional MJML renderer.
 */
export function inlineSimpleStyles(html: string, styles: Record<string, string>): string {
  let result = html;
  for (const [selector, css] of Object.entries(styles)) {
    if (!selector.startsWith('.')) {
      continue;
    }
    const className = selector.slice(1);
    const re = new RegExp(`class="([^"]*\\b${className}\\b[^"]*)"`, 'g');
    result = result.replace(re, (_match, classes: string) => {
      return `class="${classes}" style="${css}"`;
    });
  }
  return result;
}
