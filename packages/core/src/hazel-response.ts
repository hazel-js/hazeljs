import { Response } from './types';

export interface HazelResponse {
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
  status(code: number): HazelResponse;
  json(data: unknown): void;
  /** Send a Buffer as binary (e.g. audio, PDF). Sets Content-Type if provided. */
  sendBuffer?(buffer: Buffer, contentType?: string): void;
}

export class HazelExpressResponse implements HazelResponse {
  private isStreaming: boolean = false;
  private headersSent: boolean = false;

  constructor(private res: Response) {}

  setHeader(name: string, value: string): void {
    if (!this.headersSent) {
      this.res.setHeader(name, value);
    }
  }

  write(chunk: string): void {
    if (!this.isStreaming) {
      this.isStreaming = true;
      this.headersSent = true;
      this.res.setHeader('Content-Type', 'text/plain');
      this.res.setHeader('Transfer-Encoding', 'chunked');
      this.res.send(chunk);
    } else {
      this.res.send(chunk);
    }
  }

  end(): void {
    if (this.isStreaming) {
      this.res.end();
    }
  }

  status(code: number): HazelResponse {
    if (!this.headersSent) {
      this.res.status(code);
    }
    return this;
  }

  sendBuffer(buffer: Buffer, contentType?: string): void {
    if (this.isStreaming || this.headersSent) {
      return;
    }
    if (contentType) {
      this.res.setHeader('Content-Type', contentType);
    }
    (this.res as unknown as { send: (data: Buffer) => void }).send(buffer);
    this.headersSent = true;
  }

  json(data: unknown): void {
    if (this.isStreaming || this.headersSent) {
      return; // Don't try to send JSON if we're already streaming or headers are sent
    }

    try {
      if (data && typeof data === 'object') {
        // Handle error responses specially
        if ('error' in data) {
          this.res.json({ error: (data as { error: unknown }).error });
          return;
        }

        // For other objects, use a safe replacer
        const safeData = JSON.parse(
          JSON.stringify(data, (key, value) => {
            if (key === 'res' || value === this.res) {
              return '[Response Object]';
            }
            return value;
          })
        );
        this.res.json(safeData);
      } else {
        this.res.json(data);
      }
    } catch {
      // If JSON stringify fails, send a simple error message
      this.res.json({ error: 'Failed to serialize response' });
    }
  }
}
