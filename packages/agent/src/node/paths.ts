/**
 * Local Agent OS node paths under ~/.hazel (and project .hazel/).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface HazelHomePaths {
  home: string;
  configDir: string;
  agentsDir: string;
  runsDir: string;
  logsDir: string;
  secretsDir: string;
  stateDir: string;
  platformStore: string;
  socketPath: string;
  pidPath: string;
  dbPath: string;
  jobsPath: string;
  eventsPath: string;
}

export function hazelHome(root = process.env.HAZEL_HOME): HazelHomePaths {
  const home = path.resolve(root ?? path.join(os.homedir(), '.hazel'));
  return {
    home,
    configDir: path.join(home, 'config'),
    agentsDir: path.join(home, 'agents'),
    runsDir: path.join(home, 'runs'),
    logsDir: path.join(home, 'logs'),
    secretsDir: path.join(home, 'secrets'),
    stateDir: path.join(home, 'state'),
    platformStore: path.join(home, 'platform', 'resources.json'),
    socketPath:
      process.platform === 'win32'
        ? path.join('\\\\.\\pipe\\', 'hazeljs-hazeld')
        : path.join(home, 'hazeld.sock'),
    pidPath: path.join(home, 'hazeld.pid'),
    dbPath: path.join(home, 'hazel.db'),
    jobsPath: path.join(home, 'state', 'jobs.json'),
    eventsPath: path.join(home, 'platform', 'events.jsonl'),
  };
}

export function ensureHazelHome(paths: HazelHomePaths = hazelHome()): HazelHomePaths {
  for (const dir of [
    paths.home,
    paths.configDir,
    paths.agentsDir,
    paths.runsDir,
    paths.logsDir,
    paths.secretsDir,
    paths.stateDir,
    path.dirname(paths.platformStore),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return paths;
}

export function projectHazelPaths(projectRoot: string): {
  projectRoot: string;
  platformStore: string;
  durableDir: string;
  timelinePath: string;
} {
  const root = path.resolve(projectRoot);
  const durableDir = path.join(root, '.hazel', 'runs');
  return {
    projectRoot: root,
    platformStore: path.join(root, '.hazel', 'platform', 'resources.json'),
    durableDir,
    timelinePath: path.join(durableDir, 'timeline.jsonl'),
  };
}
