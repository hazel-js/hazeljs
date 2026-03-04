import { readdir, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { TranslationMap, LocaleStore } from './types';

/**
 * Loads JSON translation files from a directory and returns a locale store.
 *
 * Each file must be named <locale>.json (e.g. en.json, fr.json, zh-TW.json).
 * Nested objects in the JSON are kept as-is; key lookup via dot-notation is
 * resolved at translation time inside I18nService.
 */
export class TranslationLoader {
  /**
   * Read all *.json files from the given directory.
   * Returns a Map keyed by locale code (the filename without extension).
   */
  static async load(translationsPath: string): Promise<LocaleStore> {
    const store: LocaleStore = new Map();

    let entries: string[];
    try {
      entries = await readdir(translationsPath);
    } catch {
      // Directory does not exist — return an empty store so the service starts
      // gracefully without translations (it will return keys as-is).
      return store;
    }

    const jsonFiles = entries.filter((file) => extname(file) === '.json');

    await Promise.all(
      jsonFiles.map(async (file) => {
        const locale = basename(file, '.json');
        const filePath = join(translationsPath, file);

        try {
          const raw = await readFile(filePath, 'utf-8');
          const translations = JSON.parse(raw) as TranslationMap;
          store.set(locale, translations);
        } catch (err) {
          // Skip malformed files rather than crashing the application.
          const message = err instanceof Error ? err.message : String(err);
          process.stderr.write(
            `[@hazeljs/i18n] Failed to load translation file "${filePath}": ${message}\n`
          );
        }
      })
    );

    return store;
  }
}
