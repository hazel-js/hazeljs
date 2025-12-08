import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function copyRecursiveSync(src: string, dest: string) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      if (fs.lstatSync(srcPath).isDirectory()) {
        copyRecursiveSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

export function generateApp(program: Command) {
  program
    .command('new <appName>')
    .description('Create a new HazelJS app from the GitHub template')
    .option('-d, --dest <destPath>', 'Destination path', '.')
    .action((appName: string, options: { dest?: string }) => {
      const destPath = path.join(process.cwd(), options.dest || '.', appName);
      console.log('[hazel] Step 1: Checking destination...');
      if (fs.existsSync(destPath)) {
        console.error(`[hazel] Destination already exists: ${destPath}`);
        process.exit(1);
      }

      const tempDir = path.join(process.cwd(), '.temp-template');
      console.log('[hazel] Step 2: Preparing temp dir...');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        console.log('[hazel] Step 3: Downloading template from GitHub...');
        execSync('git clone https://github.com/jhusain/pocket-reader.git .temp-template', { stdio: 'inherit' });
        console.log('[hazel] Step 4: Copying files...');
        copyRecursiveSync(tempDir, destPath);
        console.log(`[hazel] ✓ New HazelJS app created at ${destPath}`);
      } catch (error) {
        console.error('[hazel] Failed to download template:', error);
        process.exit(1);
      } finally {
        console.log('[hazel] Step 5: Cleaning up temp dir...');
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
} 