import type { BrandTheme } from '../compose/brand';
import { DEFAULT_BRAND } from '../compose/brand';
import type { EmailDocument } from '../types/email-document';

/** Strip tags for text fallback when only HTML is present. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderText(doc: EmailDocument, brand: BrandTheme = DEFAULT_BRAND): string {
  if (doc.text) {
    return doc.text;
  }
  if (doc.html) {
    return htmlToText(doc.html);
  }

  const parts: string[] = [brand.name, ''];
  for (const section of doc.sections) {
    if (section.heading) {
      parts.push(section.heading);
    }
    parts.push(section.body, '');
  }
  if (doc.cta) {
    parts.push(`${doc.cta.label}: ${doc.cta.href}`, '');
  }
  if (doc.unsubscribe) {
    parts.push(`Unsubscribe: ${doc.unsubscribe.url}`);
  }
  if (brand.footer) {
    parts.push('', brand.footer);
  }
  return parts.join('\n').trim();
}
