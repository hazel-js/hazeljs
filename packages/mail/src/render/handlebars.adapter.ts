import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TemplateEngineOptions } from '../types/module.types';
import type { EmailDocument, MailCategory } from '../types/email-document';
import { email } from '../compose/compose';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text?: string;
}

/**
 * File-based Handlebars template adapter.
 * Looks for `{name}.hbs` (html), optional `{name}.subject.hbs` and `{name}.text.hbs`.
 */
export class HandlebarsAdapter {
  private readonly dir: string;
  private readonly options: Record<string, unknown>;
  private handlebars: {
    compile: (src: string, options?: unknown) => (ctx: unknown) => string;
  } | null = null;

  constructor(config: TemplateEngineOptions) {
    this.dir = config.dir;
    this.options = config.options ?? {};
  }

  private loadHandlebars(): {
    compile: (src: string, options?: unknown) => (ctx: unknown) => string;
  } {
    if (this.handlebars) {
      return this.handlebars;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.handlebars = require('handlebars');
    } catch {
      throw new Error(
        'handlebars is required for file templates. Install it with: npm install handlebars'
      );
    }
    return this.handlebars!;
  }

  render(name: string, context: Record<string, unknown>): RenderedTemplate {
    const hb = this.loadHandlebars();
    const htmlPath = this.resolvePath(name, ['.hbs', '.html.hbs', '.html']);
    if (!htmlPath) {
      throw new Error(`Template "${name}" not found under ${this.dir}`);
    }
    const htmlSrc = readFileSync(htmlPath, 'utf8');
    const html = hb.compile(htmlSrc, this.options)(context);

    const subjectPath = this.resolvePath(`${name}.subject`, ['.hbs', '.txt']);
    const subject = subjectPath
      ? hb.compile(readFileSync(subjectPath, 'utf8'), this.options)(context).trim()
      : String(context.subject ?? name);

    const textPath = this.resolvePath(`${name}.text`, ['.hbs', '.txt']);
    const text = textPath
      ? hb.compile(readFileSync(textPath, 'utf8'), this.options)(context)
      : undefined;

    return { subject, html, text };
  }

  toDocument(
    name: string,
    options: {
      to: EmailDocument['to'];
      context: Record<string, unknown>;
      subject?: string;
      category?: MailCategory;
      from?: EmailDocument['from'];
      locale?: string;
      tags?: Record<string, string>;
      cc?: EmailDocument['cc'];
      bcc?: EmailDocument['bcc'];
      idempotencyKey?: string;
      correlationId?: string;
      provider?: string;
    }
  ): EmailDocument {
    const rendered = this.render(name, options.context);
    const composer = email()
      .to(options.to)
      .subject(options.subject ?? rendered.subject)
      .category(options.category ?? 'transactional')
      .html(rendered.html)
      .layout('transactional');
    if (rendered.text) {
      composer.text(rendered.text);
    }
    if (options.from) {
      composer.from(options.from);
    }
    if (options.cc) {
      composer.cc(options.cc);
    }
    if (options.bcc) {
      composer.bcc(options.bcc);
    }
    if (options.locale) {
      composer.locale(options.locale);
    }
    if (options.tags) {
      composer.tags(options.tags);
    }
    if (options.idempotencyKey) {
      composer.idempotencyKey(options.idempotencyKey);
    }
    if (options.correlationId) {
      composer.correlationId(options.correlationId);
    }
    if (options.provider) {
      composer.provider(options.provider);
    }
    return composer.build();
  }

  private resolvePath(base: string, extensions: string[]): string | null {
    for (const ext of extensions) {
      const candidate = join(this.dir, `${base}${ext}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    // Also allow exact filename without extra extension when base already includes it
    const direct = join(this.dir, base);
    if (existsSync(direct)) {
      return direct;
    }
    return null;
  }
}
