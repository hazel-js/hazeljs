/**
 * YouTubeTranscriptLoader
 *
 * Downloads the caption/transcript for one or more YouTube videos and
 * converts them to `Document` objects — no extra npm dependency required.
 * Uses Node.js built-in `fetch` and parses the YouTube InnerTube API response.
 *
 * How it works:
 *  1. Fetches the YouTube watch page for the video.
 *  2. Extracts the `ytInitialPlayerResponse` JSON blob from the page HTML.
 *  3. Locates the caption tracks list and selects the preferred language.
 *  4. Fetches the caption XML file.
 *  5. Parses `<text>` elements and decodes HTML entities.
 *  6. Returns the transcript as one document (or split into segments).
 *
 * Accepts video IDs, full watch URLs, and youtu.be short URLs.
 *
 * @example
 * ```typescript
 * const loader = new YouTubeTranscriptLoader({
 *   videoId: 'dQw4w9WgXcQ',
 * });
 * const docs = await loader.load();
 * // docs[0].content === "Never gonna give you up, never gonna let you..."
 * // docs[0].metadata.title === "Rick Astley - Never Gonna Give You Up"
 * // docs[0].metadata.videoId === "dQw4w9WgXcQ"
 * ```
 *
 * Multiple videos:
 * ```typescript
 * const loader = new YouTubeTranscriptLoader({
 *   videoIds: ['VIDEO_ID_1', 'VIDEO_ID_2'],
 * });
 * ```
 *
 * Split into timed segments (useful for timestamped RAG retrieval):
 * ```typescript
 * const loader = new YouTubeTranscriptLoader({
 *   videoId: 'VIDEO_ID',
 *   segmentDuration: 120, // one document per 2-minute window
 * });
 * ```
 */

import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface YouTubeTranscriptLoaderOptions {
  /** Single YouTube video ID or URL. */
  videoId?: string;
  /** Multiple YouTube video IDs or URLs. */
  videoIds?: string[];
  /**
   * Preferred caption language code.
   * Falls back to the first available track if not found.
   * @default 'en'
   */
  language?: string;
  /**
   * If set, the transcript is split into segments of approximately this
   * many seconds.  Each segment becomes a separate `Document` with
   * `metadata.startTime` and `metadata.endTime`.
   * @default undefined (single document per video)
   */
  segmentDuration?: number;
  /**
   * Request timeout in milliseconds.
   * @default 15000
   */
  timeout?: number;
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

interface TranscriptLine {
  text: string;
  start: number;  // seconds
  duration: number;
}

@Loader({
  name: 'YouTubeTranscriptLoader',
  description: 'Downloads YouTube video transcripts/captions — no API key needed.',
})
export class YouTubeTranscriptLoader extends BaseDocumentLoader {
  private readonly videoIds: string[];
  private readonly language: string;
  private readonly segmentDuration?: number;
  private readonly timeout: number;
  private readonly extraMetadata: Record<string, unknown>;

  private static readonly YOUTUBE_BASE = 'https://www.youtube.com';
  private static readonly RE_PLAYER_RESPONSE =
    /ytInitialPlayerResponse\s*=\s*({.+?})\s*;/;
  private static readonly RE_CAPTION_TEXT = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;

  constructor(options: YouTubeTranscriptLoaderOptions) {
    super();
    if (!options.videoId && (!options.videoIds || options.videoIds.length === 0)) {
      throw new Error('YouTubeTranscriptLoader: provide at least one videoId.');
    }
    const raw = options.videoIds ?? (options.videoId ? [options.videoId] : []);
    this.videoIds = raw.map((id) => this.normaliseId(id));
    this.language = options.language ?? 'en';
    this.segmentDuration = options.segmentDuration;
    this.timeout = options.timeout ?? 15_000;
    this.extraMetadata = options.metadata ?? {};
  }

  async load(): Promise<Document[]> {
    const allDocs: Document[] = [];

    for (const videoId of this.videoIds) {
      try {
        const docs = await this.loadVideo(videoId);
        allDocs.push(...docs);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[YouTubeTranscriptLoader] Skipping ${videoId}: ${message}`);
      }
    }

    return allDocs;
  }

  // ── Private: per-video pipeline ──────────────────────────────────────────

  private async loadVideo(videoId: string): Promise<Document[]> {
    const watchUrl = `${YouTubeTranscriptLoader.YOUTUBE_BASE}/watch?v=${videoId}`;

    const html = await this.fetch(watchUrl);
    const { captionUrl, title, channelName } = this.extractCaptionInfo(html, videoId);

    const captionXml = await this.fetch(captionUrl);
    const lines = this.parseCaptionXml(captionXml);

    if (lines.length === 0) {
      throw new Error(`No transcript lines found for video ${videoId}`);
    }

    const baseMetadata: Record<string, unknown> = {
      source: watchUrl,
      videoId,
      loaderType: 'youtube-transcript',
      language: this.language,
      ...(title && { title }),
      ...(channelName && { channelName }),
      ...this.extraMetadata,
    };

    if (!this.segmentDuration) {
      const fullText = lines.map((l) => l.text).join(' ');
      return [this.createDocument(fullText, { ...baseMetadata, totalLines: lines.length })];
    }

    return this.buildSegments(lines, videoId, baseMetadata);
  }

  private extractCaptionInfo(
    html: string,
    videoId: string,
  ): { captionUrl: string; title?: string; channelName?: string } {
    // Extract ytInitialPlayerResponse
    const match = YouTubeTranscriptLoader.RE_PLAYER_RESPONSE.exec(html);
    if (!match) {
      throw new Error(
        `Could not find ytInitialPlayerResponse for video ${videoId}. ` +
        `The video may be unavailable, age-restricted, or have no captions.`,
      );
    }

    // Minimal safe JSON parse — the JSON is often very large
    let playerResponse: Record<string, unknown>;
    try {
      playerResponse = JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      throw new Error(`Failed to parse ytInitialPlayerResponse for video ${videoId}`);
    }

    const title = (
      (playerResponse as { videoDetails?: { title?: string } }).videoDetails?.title
    );
    const channelName = (
      (playerResponse as { videoDetails?: { author?: string } }).videoDetails?.author
    );

    // Navigate: captions → playerCaptionsTracklistRenderer → captionTracks[]
    const captionTracks = (
      playerResponse as {
        captions?: {
          playerCaptionsTracklistRenderer?: {
            captionTracks?: Array<{ languageCode: string; baseUrl: string }>;
          };
        };
      }
    ).captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      throw new Error(
        `No caption tracks available for video ${videoId}. ` +
        `The video may not have captions/subtitles.`,
      );
    }

    // Prefer the requested language; fall back to the first available track
    const track =
      captionTracks.find((t) => t.languageCode === this.language) ??
      captionTracks[0];

    return {
      captionUrl: `${track.baseUrl}&fmt=xml`,
      title,
      channelName,
    };
  }

  private parseCaptionXml(xml: string): TranscriptLine[] {
    const lines: TranscriptLine[] = [];
    const re = new RegExp(YouTubeTranscriptLoader.RE_CAPTION_TEXT.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(xml)) !== null) {
      const start = parseFloat(match[1]);
      const duration = parseFloat(match[2]);
      const raw = match[3];
      const text = this.decodeEntities(raw.replace(/<[^>]+>/g, '')).trim();
      if (text) lines.push({ start, duration, text });
    }

    return lines;
  }

  private buildSegments(
    lines: TranscriptLine[],
    videoId: string,
    baseMetadata: Record<string, unknown>,
  ): Document[] {
    const segments: Document[] = [];
    const duration = this.segmentDuration!;

    let segStart = 0;
    let buffer: string[] = [];
    let windowEnd = segStart + duration;

    for (const line of lines) {
      if (line.start >= windowEnd) {
        if (buffer.length > 0) {
          const text = buffer.join(' ');
          const startTime = this.formatTime(segStart);
          const endTime = this.formatTime(windowEnd);
          segments.push(this.createDocument(text, {
            ...baseMetadata,
            startTime,
            endTime,
            startSeconds: segStart,
            youtubeUrl: `https://youtu.be/${videoId}?t=${Math.floor(segStart)}`,
          }));
          buffer = [];
        }
        segStart = Math.floor(line.start / duration) * duration;
        windowEnd = segStart + duration;
      }
      buffer.push(line.text);
    }

    // Final segment
    if (buffer.length > 0) {
      segments.push(this.createDocument(buffer.join(' '), {
        ...baseMetadata,
        startTime: this.formatTime(segStart),
        endTime: this.formatTime(windowEnd),
        startSeconds: segStart,
        youtubeUrl: `https://youtu.be/${videoId}?t=${Math.floor(segStart)}`,
      }));
    }

    return segments;
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  private normaliseId(input: string): string {
    // youtu.be/ID
    const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    // youtube.com/watch?v=ID
    const watchMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    // Already an 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    throw new Error(`YouTubeTranscriptLoader: cannot parse video ID from "${input}"`);
  }

  private async fetch(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
    }

    return response.text();
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  }

  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s]
      .map((v) => String(v).padStart(2, '0'))
      .join(':');
  }
}
