import { readdirSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { TranslationMap, LocaleStore } from './types';

/**
 * Loads JSON translation files from a directory and returns a locale store.
 *
 * Each file must be named <locale>.json (e.g. en.json, fr.json, zh-TW.json).
 * Nested objects in the JSON are kept as-is; key lookup via dot-notation is
 * resolved at translation time inside I18nService.
 *
 * Synchronous I/O is intentional: HazelJS's DI container resolves providers
 * synchronously, so async factories would result in a Promise being stored
 * as the service instance rather than the resolved value.
 */
export class TranslationLoader {
  /**
   * Read all *.json files from the given directory synchronously.
   * Returns a Map keyed by locale code (the filename without extension).
   */
  static load(translationsPath: string): LocaleStore {
    const store: LocaleStore = new Map();

    let entries: string[];
    try {
      entries = readdirSync(translationsPath);
    } catch {
      // Directory does not exist — return an empty store so the service starts
      // gracefully without translations (it will return keys as-is).
      return store;
    }

    const jsonFiles = entries.filter((file) => extname(file) === '.json');

    for (const file of jsonFiles) {
      const locale = basename(file, '.json');
      const filePath = join(translationsPath, file);

      try {
        const raw = readFileSync(filePath, 'utf-8');
        const translations = JSON.parse(raw) as TranslationMap;
        store.set(locale, translations);
      } catch (err) {
        // Skip malformed files rather than crashing the application.
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `[@hazeljs/i18n] Failed to load translation file "${filePath}": ${message}\n`
        );
      }
    }

    return store;
  }
}
