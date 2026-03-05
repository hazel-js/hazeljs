/**
 * @hazeljs/rag — Document Loaders
 *
 * All document loaders that ship with @hazeljs/rag.
 *
 * Built-in loaders (no extra dependencies):
 *  - TextFileLoader          .txt, .log
 *  - JSONFileLoader          .json
 *  - CSVFileLoader           .csv
 *  - MarkdownFileLoader      .md, .mdx
 *  - HTMLFileLoader          .html, .htm
 *  - DirectoryLoader         walks a directory and delegates to the above
 *  - WebLoader               fetches web pages (Node.js fetch)
 *  - YouTubeTranscriptLoader YouTube captions via ytInitialPlayerResponse
 *  - GitHubLoader            GitHub REST API (no extra dep)
 *
 * Optional-dependency loaders (graceful error if dep not installed):
 *  - PdfLoader               requires: npm install pdf-parse
 *  - DocxLoader              requires: npm install mammoth
 *  - WebLoader (selector)    requires: npm install cheerio  (only for the `selector` option)
 *
 * Base class and decorator (extend to build your own):
 *  - BaseDocumentLoader
 *  - @Loader
 *  - DocumentLoaderRegistry
 *  - LoaderConfig
 */

export { BaseDocumentLoader, Loader, getLoaderConfig, DocumentLoaderRegistry } from './base.loader';
export type { LoaderConfig } from './base.loader';

// ── File-system loaders ───────────────────────────────────────────────────
export { TextFileLoader } from './text-file.loader';
export { JSONFileLoader } from './json-file.loader';
export { CSVFileLoader } from './csv-file.loader';
export { MarkdownFileLoader } from './markdown-file.loader';
export { HTMLFileLoader } from './html-file.loader';
export { DirectoryLoader } from './directory.loader';

// ── Format loaders (optional deps) ───────────────────────────────────────
export { PdfLoader } from './pdf.loader';
export { DocxLoader } from './docx.loader';

// ── Remote loaders ────────────────────────────────────────────────────────
export { WebLoader } from './web.loader';
export { YouTubeTranscriptLoader } from './youtube-transcript.loader';
export { GitHubLoader } from './github.loader';

// ── Option types ──────────────────────────────────────────────────────────
export type { TextFileLoaderOptions } from './text-file.loader';
export type { JSONFileLoaderOptions } from './json-file.loader';
export type { CSVFileLoaderOptions } from './csv-file.loader';
export type { MarkdownFileLoaderOptions } from './markdown-file.loader';
export type { HTMLFileLoaderOptions } from './html-file.loader';
export type { DirectoryLoaderOptions, LoaderFactory } from './directory.loader';
export type { PdfLoaderOptions } from './pdf.loader';
export type { DocxLoaderOptions } from './docx.loader';
export type { WebLoaderOptions } from './web.loader';
export type { YouTubeTranscriptLoaderOptions } from './youtube-transcript.loader';
export type { GitHubLoaderOptions } from './github.loader';
