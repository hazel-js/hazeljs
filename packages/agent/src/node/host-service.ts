/**
 * Host service manager — install hazeld to survive reboot (launchd / systemd / Windows task).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { hazelHome, ensureHazelHome } from './paths';

export interface HostServiceManager {
  install(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  uninstall(): Promise<void>;
  status(): Promise<{ installed: boolean; running: boolean; detail?: string }>;
}

export interface HostServiceOptions {
  /** Absolute path to hazeld binary or `node /path/to/hazeld.js` */
  command: string;
  label?: string;
  home?: string;
}

export function createHostServiceManager(options: HostServiceOptions): HostServiceManager {
  const platform = process.platform;
  if (platform === 'darwin') return new LaunchdHostService(options);
  if (platform === 'linux') return new SystemdUserHostService(options);
  if (platform === 'win32') return new WindowsTaskHostService(options);
  return new NoopHostService(options);
}

class NoopHostService implements HostServiceManager {
  constructor(private readonly options: HostServiceOptions) {}
  async install(): Promise<void> {
    throw new Error(`Host service install not supported on ${process.platform}`);
  }
  async start(): Promise<void> {
    void this.options;
  }
  async stop(): Promise<void> {}
  async uninstall(): Promise<void> {}
  async status() {
    return { installed: false, running: false, detail: process.platform };
  }
}

class LaunchdHostService implements HostServiceManager {
  private readonly plistPath: string;
  private readonly label: string;

  constructor(private readonly options: HostServiceOptions) {
    this.label = options.label ?? 'ai.hazeljs.hazeld';
    this.plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${this.label}.plist`);
  }

  async install(): Promise<void> {
    ensureHazelHome(hazelHome(this.options.home));
    const home = hazelHome(this.options.home);
    const parts = this.options.command.split(' ').filter(Boolean);
    const programArgs = parts.map((p) => `    <string>${escapeXml(p)}</string>`).join('\n');
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${this.label}</string>
  <key>ProgramArguments</key>
  <array>
${programArgs}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(home.logsDir, 'hazeld.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(home.logsDir, 'hazeld.err.log'))}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HAZEL_HOME</key>
    <string>${escapeXml(home.home)}</string>
  </dict>
</dict>
</plist>
`;
    fs.mkdirSync(path.dirname(this.plistPath), { recursive: true });
    fs.writeFileSync(this.plistPath, plist);
    try {
      execFileSync('launchctl', ['unload', this.plistPath], { stdio: 'ignore' });
    } catch {
      // not loaded
    }
    execFileSync('launchctl', ['load', this.plistPath], { stdio: 'ignore' });
  }

  async start(): Promise<void> {
    execFileSync('launchctl', ['start', this.label], { stdio: 'ignore' });
  }

  async stop(): Promise<void> {
    try {
      execFileSync('launchctl', ['stop', this.label], { stdio: 'ignore' });
    } catch {
      // ignore
    }
  }

  async uninstall(): Promise<void> {
    try {
      execFileSync('launchctl', ['unload', this.plistPath], { stdio: 'ignore' });
    } catch {
      // ignore
    }
    if (fs.existsSync(this.plistPath)) fs.unlinkSync(this.plistPath);
  }

  async status() {
    const installed = fs.existsSync(this.plistPath);
    let running = false;
    try {
      const out = execFileSync('launchctl', ['list', this.label], { encoding: 'utf8' });
      running = /"PID"\s*=\s*\d+/.test(out) || /^\d+\t/.test(out.trim());
    } catch {
      running = false;
    }
    return { installed, running, detail: this.plistPath };
  }
}

class SystemdUserHostService implements HostServiceManager {
  private readonly unitPath: string;
  private readonly unitName: string;

  constructor(private readonly options: HostServiceOptions) {
    this.unitName = options.label ?? 'hazeld';
    this.unitPath = path.join(
      os.homedir(),
      '.config',
      'systemd',
      'user',
      `${this.unitName}.service`
    );
  }

  async install(): Promise<void> {
    const home = ensureHazelHome(hazelHome(this.options.home));
    const unit = `[Unit]
Description=HazelJS Agent OS Node (hazeld)
After=default.target

[Service]
Type=simple
ExecStart=${this.options.command}
Restart=always
RestartSec=3
Environment=HAZEL_HOME=${home.home}
WorkingDirectory=${home.home}

[Install]
WantedBy=default.target
`;
    fs.mkdirSync(path.dirname(this.unitPath), { recursive: true });
    fs.writeFileSync(this.unitPath, unit);
    execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'ignore' });
    execFileSync('systemctl', ['--user', 'enable', '--now', `${this.unitName}.service`], {
      stdio: 'ignore',
    });
  }

  async start(): Promise<void> {
    execFileSync('systemctl', ['--user', 'start', `${this.unitName}.service`], {
      stdio: 'ignore',
    });
  }

  async stop(): Promise<void> {
    execFileSync('systemctl', ['--user', 'stop', `${this.unitName}.service`], {
      stdio: 'ignore',
    });
  }

  async uninstall(): Promise<void> {
    try {
      execFileSync('systemctl', ['--user', 'disable', '--now', `${this.unitName}.service`], {
        stdio: 'ignore',
      });
    } catch {
      // ignore
    }
    if (fs.existsSync(this.unitPath)) fs.unlinkSync(this.unitPath);
  }

  async status() {
    const installed = fs.existsSync(this.unitPath);
    let running = false;
    try {
      const out = execFileSync('systemctl', ['--user', 'is-active', `${this.unitName}.service`], {
        encoding: 'utf8',
      }).trim();
      running = out === 'active';
    } catch {
      running = false;
    }
    return { installed, running, detail: this.unitPath };
  }
}

class WindowsTaskHostService implements HostServiceManager {
  private readonly taskName: string;

  constructor(private readonly options: HostServiceOptions) {
    this.taskName = options.label ?? 'HazelJSHazeld';
  }

  async install(): Promise<void> {
    execFileSync(
      'schtasks',
      [
        '/Create',
        '/TN',
        this.taskName,
        '/TR',
        this.options.command,
        '/SC',
        'ONLOGON',
        '/RL',
        'LIMITED',
        '/F',
      ],
      { stdio: 'ignore' }
    );
  }

  async start(): Promise<void> {
    execFileSync('schtasks', ['/Run', '/TN', this.taskName], { stdio: 'ignore' });
  }

  async stop(): Promise<void> {
    try {
      execFileSync('schtasks', ['/End', '/TN', this.taskName], { stdio: 'ignore' });
    } catch {
      // ignore
    }
  }

  async uninstall(): Promise<void> {
    try {
      execFileSync('schtasks', ['/Delete', '/TN', this.taskName, '/F'], { stdio: 'ignore' });
    } catch {
      // ignore
    }
  }

  async status() {
    try {
      execFileSync('schtasks', ['/Query', '/TN', this.taskName], { stdio: 'ignore' });
      return { installed: true, running: false, detail: this.taskName };
    } catch {
      return { installed: false, running: false, detail: this.taskName };
    }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
