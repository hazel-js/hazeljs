import type { z } from 'zod';
import type { EmailDocument, MailAddress } from '../types/email-document';
import { email, type EmailComposer } from './compose';

export interface MailableDefinition<T> {
  name: string;
  schema?: z.ZodType<T>;
  build: (data: T, helpers: { email: () => EmailComposer }) => EmailDocument;
}

export interface MailableClass<T> {
  readonly name: string;
  schema?: z.ZodType<T>;
  render(data: T): EmailDocument;
}

export function defineMailable<T>(definition: MailableDefinition<T>): MailableClass<T> {
  return {
    name: definition.name,
    schema: definition.schema,
    render(data: T): EmailDocument {
      if (definition.schema) {
        definition.schema.parse(data);
      }
      return definition.build(data, { email });
    },
  };
}

/** Discoverable registry of typed mailables. */
export class MailCatalog {
  private readonly items = new Map<string, MailableClass<unknown>>();

  register<T>(mailable: MailableClass<T>): this {
    this.items.set(mailable.name, mailable as MailableClass<unknown>);
    return this;
  }

  get<T = unknown>(name: string): MailableClass<T> | undefined {
    return this.items.get(name) as MailableClass<T> | undefined;
  }

  list(): string[] {
    return [...this.items.keys()];
  }

  render<T>(name: string, data: T): EmailDocument {
    const mailable = this.items.get(name);
    if (!mailable) {
      throw new Error(`Mailable "${name}" is not registered in the MailCatalog`);
    }
    return mailable.render(data);
  }

  renderTo(name: string, to: MailAddress | MailAddress[], data: unknown): EmailDocument {
    const doc = this.render(name, data);
    return { ...doc, to: Array.isArray(to) ? to : [to] };
  }
}

export const globalMailCatalog = new MailCatalog();
