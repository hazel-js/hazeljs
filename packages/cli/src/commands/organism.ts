import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_STORE = path.join('.hazel', 'organisms.json');

interface StoredOrganismSnapshot {
  id: string;
  status: string;
  mission: { id: string; objective: string };
  agents: Array<{ id: string; name?: string; status: string; generation: number }>;
  genealogy?: unknown[];
  resources?: unknown;
  events?: unknown[];
  updatedAt: string;
}

function loadStore(storePath: string): Record<string, StoredOrganismSnapshot> {
  const resolved = path.resolve(storePath);
  if (!fs.existsSync(resolved)) return {};
  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8')) as Record<string, StoredOrganismSnapshot>;
  } catch {
    return {};
  }
}

function saveStore(storePath: string, data: Record<string, StoredOrganismSnapshot>): void {
  const resolved = path.resolve(storePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2));
}

/**
 * `hazel organism` — inspect / control organism snapshots (Phase 1).
 * Live runtime control uses the programmatic API; CLI reads/writes local snapshots.
 */
export function registerOrganismCommand(program: Command): void {
  const org = program.command('organism').description('Agentic Organism Runtime commands');

  org
    .command('list')
    .description('List known organisms from the local snapshot store')
    .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
    .option('--json', 'Print JSON')
    .action((opts: { store: string; json?: boolean }) => {
      const data = loadStore(opts.store);
      const rows = Object.values(data);
      if (opts.json) {
        console.log(JSON.stringify({ organisms: rows }, null, 2));
        return;
      }
      if (!rows.length) {
        console.log('No organisms found. Use createOrganism() then persist a snapshot.');
        return;
      }
      for (const r of rows) {
        console.log(`${r.id}\t${r.status}\t${r.mission.objective}`);
      }
    });

  org
    .command('inspect <id>')
    .description('Inspect an organism snapshot')
    .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
    .option('--json', 'Print JSON')
    .action((id: string, opts: { store: string; json?: boolean }) => {
      const data = loadStore(opts.store);
      const snap = data[id];
      if (!snap) {
        console.error(`Organism not found: ${id}`);
        process.exitCode = 1;
        return;
      }
      console.log(opts.json ? JSON.stringify(snap, null, 2) : formatInspect(snap));
    });

  org
    .command('agents <id>')
    .description('List agents for an organism')
    .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
    .option('--json', 'Print JSON')
    .action((id: string, opts: { store: string; json?: boolean }) => {
      const snap = loadStore(opts.store)[id];
      if (!snap) {
        console.error(`Organism not found: ${id}`);
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify({ agents: snap.agents }, null, 2));
        return;
      }
      for (const a of snap.agents) {
        console.log(`${a.id}\t${a.status}\tgen=${a.generation}\t${a.name ?? ''}`);
      }
    });

  org
    .command('genealogy <id>')
    .description('Show agent genealogy')
    .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
    .option('--json', 'Print JSON')
    .action((id: string, opts: { store: string; json?: boolean }) => {
      const snap = loadStore(opts.store)[id];
      if (!snap) {
        console.error(`Organism not found: ${id}`);
        process.exitCode = 1;
        return;
      }
      console.log(
        opts.json
          ? JSON.stringify(snap.genealogy ?? [], null, 2)
          : JSON.stringify(snap.genealogy ?? [], null, 2)
      );
    });

  org
    .command('resources <id>')
    .description('Show organism resource pool')
    .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
    .option('--json', 'Print JSON')
    .action((id: string, opts: { store: string; json?: boolean }) => {
      const snap = loadStore(opts.store)[id];
      if (!snap) {
        console.error(`Organism not found: ${id}`);
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(snap.resources ?? {}, null, 2));
    });

  org
    .command('events <id>')
    .description('Show recent organism events')
    .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
    .option('--json', 'Print JSON')
    .action((id: string, opts: { store: string; json?: boolean }) => {
      const snap = loadStore(opts.store)[id];
      if (!snap) {
        console.error(`Organism not found: ${id}`);
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(snap.events ?? [], null, 2));
    });

  for (const action of ['pause', 'resume', 'stop'] as const) {
    org
      .command(`${action} <id>`)
      .description(`${action} an organism snapshot (status flag only in Phase 1 CLI)`)
      .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
      .action((id: string, opts: { store: string }) => {
        const data = loadStore(opts.store);
        const snap = data[id];
        if (!snap) {
          console.error(`Organism not found: ${id}`);
          process.exitCode = 1;
          return;
        }
        snap.status =
          action === 'pause' ? 'paused' : action === 'resume' ? 'operating' : 'terminated';
        snap.updatedAt = new Date().toISOString();
        data[id] = snap;
        saveStore(opts.store, data);
        console.log(`Organism ${id} marked ${snap.status}`);
      });
  }

  org
    .command('save-snapshot')
    .description('Helper: write a minimal demo snapshot for CLI testing')
    .option('--store <path>', 'Snapshot store path', DEFAULT_STORE)
    .option('--id <id>', 'Organism id', 'demo-org')
    .action((opts: { store: string; id: string }) => {
      const data = loadStore(opts.store);
      data[opts.id] = {
        id: opts.id,
        status: 'operating',
        mission: {
          id: 'demo',
          objective: 'Operate customer support while maintaining 90% CSAT',
        },
        agents: [],
        genealogy: [],
        resources: { tokensRemaining: 5_000_000 },
        events: [],
        updatedAt: new Date().toISOString(),
      };
      saveStore(opts.store, data);
      console.log(`Wrote snapshot ${opts.id} to ${opts.store}`);
    });
}

function formatInspect(snap: StoredOrganismSnapshot): string {
  return [
    `id: ${snap.id}`,
    `status: ${snap.status}`,
    `mission: ${snap.mission.objective}`,
    `agents: ${snap.agents.length}`,
    `updatedAt: ${snap.updatedAt}`,
  ].join('\n');
}
