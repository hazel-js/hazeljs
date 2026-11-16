import type { BrandTheme } from '../compose/brand';
import { DEFAULT_BRAND } from '../compose/brand';
import type { EmailDocument } from '../types/email-document';
import { escapeHtml } from './escape';
import { renderHtml } from './html.renderer';

/**
 * Optional MJML renderer. Requires the `mjml` peer dependency.
 * Falls back to the HTML renderer when mjml is not installed.
 */
export async function renderMjml(
  doc: EmailDocument,
  brand: BrandTheme = DEFAULT_BRAND
): Promise<string> {
  let mjml: { default?: (input: string) => { html: string }; (input: string): { html: string } };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mjml = require('mjml');
  } catch {
    return renderHtml(doc, brand);
  }

  const colors = {
    primary: brand.colors?.primary ?? '#0F766E',
    text: brand.colors?.text ?? '#111827',
  };

  const sections = doc.sections
    .map((section) => {
      const heading = section.heading
        ? `<mj-text font-size="18px" font-weight="700" color="${colors.text}">${escapeHtml(section.heading)}</mj-text>`
        : '';
      const body = `<mj-text color="${colors.text}">${escapeHtml(section.body).replace(/\n/g, '<br/>')}</mj-text>`;
      return `${heading}${body}`;
    })
    .join('');

  const cta = doc.cta
    ? `<mj-button background-color="${colors.primary}" href="${escapeHtml(doc.cta.href)}">${escapeHtml(doc.cta.label)}</mj-button>`
    : '';

  const input = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="20px" font-weight="700" color="${colors.primary}">${escapeHtml(brand.name)}</mj-text>
        ${sections}
        ${cta}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

  const compile = mjml.default ?? mjml;
  return compile(input).html;
}
