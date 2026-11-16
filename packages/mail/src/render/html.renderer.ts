import type { BrandTheme } from '../compose/brand';
import { DEFAULT_BRAND } from '../compose/brand';
import type { EmailDocument } from '../types/email-document';
import { escapeHtml } from './escape';

export function renderHtml(doc: EmailDocument, brand: BrandTheme = DEFAULT_BRAND): string {
  if (doc.html) {
    return doc.html;
  }

  const colors = {
    primary: brand.colors?.primary ?? '#0F766E',
    background: brand.colors?.background ?? '#FFFFFF',
    text: brand.colors?.text ?? '#111827',
    muted: brand.colors?.muted ?? '#6B7280',
    buttonText: brand.colors?.buttonText ?? '#FFFFFF',
  };

  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" width="120" style="display:block;margin-bottom:24px;" />`
    : `<div style="font-size:20px;font-weight:700;color:${colors.primary};margin-bottom:24px;">${escapeHtml(brand.name)}</div>`;

  const sections = doc.sections
    .map((section) => {
      const heading = section.heading
        ? `<h2 style="margin:0 0 8px;font-size:18px;color:${colors.text};">${escapeHtml(section.heading)}</h2>`
        : '';
      const body = section.html
        ? section.html
        : `<p style="margin:0 0 16px;line-height:1.6;color:${colors.text};">${escapeHtml(section.body).replace(/\n/g, '<br/>')}</p>`;
      return `<div style="margin-bottom:20px;">${heading}${body}</div>`;
    })
    .join('');

  const cta = doc.cta
    ? `<p style="margin:28px 0;"><a href="${escapeHtml(doc.cta.href)}" style="display:inline-block;background:${colors.primary};color:${colors.buttonText};text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">${escapeHtml(doc.cta.label)}</a></p>`
    : '';

  const unsub = doc.unsubscribe
    ? `<p style="margin:24px 0 0;font-size:12px;color:${colors.muted};"><a href="${escapeHtml(doc.unsubscribe.url)}" style="color:${colors.muted};">Unsubscribe</a></p>`
    : '';

  const footer = brand.footer
    ? `<p style="margin:16px 0 0;font-size:12px;color:${colors.muted};">${escapeHtml(brand.footer)}</p>`
    : '';

  const maxWidth = doc.layout === 'plain' ? '100%' : '560px';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(doc.locale ?? 'en')}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F3F4F6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:${maxWidth};background:${colors.background};border-radius:8px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <tr><td>
          ${logo}
          ${sections}
          ${cta}
          ${unsub}
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
