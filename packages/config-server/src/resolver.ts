import * as fs from 'fs';
import * as path from 'path';
import type { PropertySource } from './types';
import { isConfigFile, readConfigFile } from './parse';

export interface ResolveOptions {
  root: string;
  application: string;
  profiles: string[];
  searchPaths?: string[];
}

function expandTemplate(
  template: string,
  application: string,
  profile: string,
  label?: string
): string {
  return template
    .replace(/\{application\}/g, application)
    .replace(/\{profile\}/g, profile)
    .replace(/\{label\}/g, label ?? '');
}

function listConfigFiles(dir: string): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => isConfigFile(name))
    .map((name) => path.join(dir, name));
}

function stem(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Later sources override earlier ones (Spring Cloud Config order):
 * application → application-{profile} → {application} → {application}-{profile}
 * then files under searchPaths.
 */
export function resolvePropertySources(options: ResolveOptions): PropertySource[] {
  const { root, application, profiles } = options;
  const sources: PropertySource[] = [];
  const seen = new Set<string>();

  const addFile = (filePath: string): void => {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return;
    }
    seen.add(resolved);
    sources.push({
      name: path.relative(root, resolved) || path.basename(resolved),
      source: readConfigFile(resolved),
    });
  };

  const addNamed = (dir: string, names: string[]): void => {
    const files = listConfigFiles(dir);
    for (const name of names) {
      for (const file of files) {
        if (stem(file) === name) {
          addFile(file);
        }
      }
    }
  };

  const namedFor = (profile?: string): string[] => {
    if (!profile) {
      return ['application', application];
    }
    return [`application-${profile}`, `${application}-${profile}`];
  };

  addNamed(root, ['application']);
  for (const profile of profiles) {
    addNamed(root, [`application-${profile}`]);
  }
  addNamed(root, [application]);
  for (const profile of profiles) {
    addNamed(root, [`${application}-${profile}`]);
  }

  for (const template of options.searchPaths ?? []) {
    if (!profiles.length) {
      const dir = path.join(root, expandTemplate(template, application, '', undefined));
      addNamed(dir, namedFor());
      for (const file of listConfigFiles(dir)) {
        addFile(file);
      }
      continue;
    }
    for (const profile of profiles) {
      const dir = path.join(root, expandTemplate(template, application, profile, undefined));
      addNamed(dir, [
        'application',
        `application-${profile}`,
        application,
        `${application}-${profile}`,
      ]);
      for (const file of listConfigFiles(dir)) {
        addFile(file);
      }
    }
  }

  return sources;
}
