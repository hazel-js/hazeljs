import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const DEFAULT_API_URL = process.env.HAZEL_API_URL || 'http://localhost:3000';

async function submitJob(
  apiUrl: string,
  filePath: string,
  options: { voice?: string; includeSummary?: boolean; summaryOnly?: boolean }
): Promise<string> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath), path.basename(filePath));
  if (options.voice) formData.append('voice', options.voice);
  if (options.includeSummary === false) formData.append('includeSummary', 'false');
  if (options.summaryOnly === true) formData.append('summaryOnly', 'true');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await fetch(`${apiUrl}/api/pdf-to-audio/convert`, {
    method: 'POST',
    body: formData as any,
    headers: formData.getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { jobId?: string };
  if (!json.jobId) throw new Error('No jobId in response');
  return json.jobId;
}

async function getStatus(apiUrl: string, jobId: string) {
  const res = await fetch(`${apiUrl}/api/pdf-to-audio/status/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Status failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as {
    jobId: string;
    status: string;
    progress: number;
    message?: string;
    totalChunks?: number;
    completedChunks?: number;
    error?: string;
  };
}

async function downloadAudio(apiUrl: string, jobId: string): Promise<Buffer> {
  const res = await fetch(`${apiUrl}/api/pdf-to-audio/download/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${await res.text()}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function pdfToAudioCommand(program: Command) {
  const pdfToAudio = program
    .command('pdf-to-audio')
    .description('Convert PDF to audio via async job (submit, poll status, download)');

  pdfToAudio
    .command('convert <file.pdf>')
    .description('Submit PDF for conversion, returns job ID')
    .option('-o, --output <path>', 'Output MP3 path (used with --wait)')
    .option('--voice <name>', 'TTS voice (alloy, echo, fable, onyx, nova, shimmer, ash, sage, coral)', 'alloy')
    .option('--no-summary', 'Skip AI-generated document summary')
    .option('--summary-only', 'Output only the summary, do not read the full document')
    .option('--api-url <url>', 'API base URL', DEFAULT_API_URL)
    .option('--wait', 'Poll until complete and download to --output')
    .option('--poll-interval <ms>', 'Poll interval in ms', '3000')
    .action(
      async (
        filePath: string,
        opts: {
          output?: string;
          voice?: string;
          summary?: boolean;
          summaryOnly?: boolean;
          apiUrl?: string;
          wait?: boolean;
          pollInterval?: string;
        }
      ) => {
        try {
          if (!filePath?.toLowerCase().endsWith('.pdf')) {
            console.log(chalk.red('✗ Please provide a PDF file path'));
            process.exit(1);
          }

          const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
          if (!fs.existsSync(resolvedPath)) {
            console.log(chalk.red(`✗ File not found: ${resolvedPath}`));
            process.exit(1);
          }

          const apiUrl = (opts.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
          const includeSummary = opts.summary !== false;
          const summaryOnly = opts.summaryOnly === true;

          console.log(chalk.blue('📄 Submitting PDF for conversion...'));
          console.log(chalk.gray(`  API:   ${apiUrl}`));
          console.log(chalk.gray(`  File:  ${resolvedPath}`));
          console.log(chalk.gray(`  Voice: ${opts.voice || 'alloy'}`));
          if (summaryOnly) console.log(chalk.gray(`  Mode:  summary only`));

          const jobId = await submitJob(apiUrl, resolvedPath, {
            voice: opts.voice,
            includeSummary,
            summaryOnly,
          });

          console.log(chalk.green(`\n✓ Job submitted: ${jobId}`));

          if (opts.wait) {
            const outputPath =
              opts.output ||
              path.join(path.dirname(resolvedPath), path.basename(resolvedPath, '.pdf') + '.mp3');
            const interval = parseInt(opts.pollInterval || '3000', 10);

            console.log(chalk.gray(`\nPolling every ${interval}ms...`));
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const status = await getStatus(apiUrl, jobId);
              if (!status) {
                console.log(chalk.red('✗ Job not found or expired'));
                process.exit(1);
              }
              const pct = status.progress ?? 0;
              const msg = status.message ? ` - ${status.message}` : '';
              process.stdout.write(
                chalk.gray(`  Status: ${status.status} ${pct}%${msg}`)
              );
              if (status.status === 'completed') {
                console.log(chalk.gray(' done'));
                const audio = await downloadAudio(apiUrl, jobId);
                fs.writeFileSync(outputPath, audio);
                console.log(chalk.green(`\n✓ Saved: ${outputPath}`));
                return;
              }
              if (status.status === 'failed') {
                console.log(chalk.red(`\n✗ Conversion failed: ${status.error || 'Unknown error'}`));
                process.exit(1);
              }
              console.log('');
              await new Promise((r) => setTimeout(r, interval));
            }
          }

          console.log(chalk.gray('\nCheck status: hazel pdf-to-audio status ' + jobId + ' --api-url ' + apiUrl));
          if (opts.output) {
            console.log(chalk.gray('Download when ready: hazel pdf-to-audio status ' + jobId + ' -o ' + opts.output + ' --api-url ' + apiUrl));
          }
        } catch (error) {
          console.error(chalk.red('\n✗ Error:'), error instanceof Error ? error.message : error);
          process.exit(1);
        }
      }
    );

  pdfToAudio
    .command('status <jobId>')
    .description('Check job status and optionally download when ready')
    .option('-o, --output <path>', 'Download audio to this path when completed')
    .option('--api-url <url>', 'API base URL', DEFAULT_API_URL)
    .action(async (jobId: string, opts: { output?: string; apiUrl?: string }) => {
      try {
        const apiUrl = (opts.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');

        const status = await getStatus(apiUrl, jobId);
        if (!status) {
          console.log(chalk.red('✗ Job not found or expired'));
          process.exit(1);
        }

        console.log(chalk.blue('Job status:'));
        console.log(chalk.gray(`  ID:       ${status.jobId}`));
        console.log(chalk.gray(`  Status:   ${status.status}`));
        console.log(chalk.gray(`  Progress: ${status.progress}%`));
        if (status.message) console.log(chalk.gray(`  Message:  ${status.message}`));
        if (status.totalChunks != null) {
          console.log(chalk.gray(`  Chunks:   ${status.completedChunks ?? 0}/${status.totalChunks}`));
        }
        if (status.error) console.log(chalk.red(`  Error:    ${status.error}`));

        if (status.status === 'completed' && opts.output) {
          const audio = await downloadAudio(apiUrl, jobId);
          fs.writeFileSync(opts.output, audio);
          console.log(chalk.green(`\n✓ Downloaded: ${opts.output}`));
        } else if (status.status === 'completed' && !opts.output) {
          console.log(chalk.gray('\nDownload: GET ' + apiUrl + '/api/pdf-to-audio/download/' + jobId));
        }
      } catch (error) {
        console.error(chalk.red('\n✗ Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
