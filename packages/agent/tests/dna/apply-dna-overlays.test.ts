import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  applyDnaOverlays,
  formatDnaOverlayReport,
  overlayDnaWithoutTools,
} from '../../src/dna/apply-dna-overlays';
import { defineAgent } from '../../src/os/define-agent';

describe('apply-dna-overlays', () => {
  it('strips tools for overlay reloads', () => {
    const dna = defineAgent({
      name: 'support',
      mission: 'Help customers',
      skills: ['kb.search', 'email.send'],
    });
    const overlay = overlayDnaWithoutTools(dna);
    expect(overlay.name).toBe('support');
    expect(overlay.tools).toBeUndefined();
    expect(overlay.mission?.goal).toContain('customers');
  });

  it('returns disabled report when AGENT_OS_DNA_OVERLAY=0', async () => {
    const runtime = {
      getAgentMetadata: () => ({}),
      hotReloadDna: () => ({
        agentName: 'x',
        dnaVersion: '1',
        updated: [] as string[],
      }),
    };
    const report = await applyDnaOverlays(runtime, {
      env: { AGENT_OS_DNA_OVERLAY: '0' } as NodeJS.ProcessEnv,
      projectRoot: os.tmpdir(),
    });
    expect(report.enabled).toBe(false);
    expect(formatDnaOverlayReport(report)).toBe('DNA overlay disabled');
  });

  it('skips when no overlay sources exist', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dna-overlay-'));
    try {
      const runtime = {
        getAgentMetadata: () => undefined,
        hotReloadDna: jest.fn(),
      };
      const report = await applyDnaOverlays(runtime, {
        env: {} as NodeJS.ProcessEnv,
        projectRoot: root,
      });
      expect(report.enabled).toBe(true);
      expect(report.applied).toEqual([]);
      expect(report.skipped.some((s) => s.includes('no platform'))).toBe(true);
      expect(formatDnaOverlayReport(report)).toMatch(/nothing applied/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('applies marketplace file overlay onto a registered agent', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dna-overlay-'));
    const dnaDir = path.join(root, 'dna');
    fs.mkdirSync(dnaDir, { recursive: true });
    const dna = defineAgent({
      name: 'desk',
      mission: 'Answer tickets',
      skills: ['kb.search'],
      autonomy: 'medium',
    });
    fs.writeFileSync(
      path.join(dnaDir, 'desk.marketplace.json'),
      JSON.stringify({
        name: 'desk-pack',
        version: '1.0.0',
        dna,
      }),
      'utf8'
    );

    const hotReloadDna = jest.fn().mockReturnValue({
      agentName: 'desk',
      dnaVersion: dna.version ?? '1',
      updated: ['mission'],
    });
    const onApplied = jest.fn();
    const report = await applyDnaOverlays(
      {
        getAgentMetadata: (name: string) => (name === 'desk' ? { name: 'desk' } : undefined),
        hotReloadDna,
      },
      { projectRoot: root, env: {} as NodeJS.ProcessEnv, onApplied }
    );

    expect(report.applied).toHaveLength(1);
    expect(report.applied[0].source).toBe('file');
    expect(hotReloadDna).toHaveBeenCalled();
    expect(onApplied).toHaveBeenCalled();
    expect(formatDnaOverlayReport(report)).toMatch(/desk/);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('skips overlay when agent is not registered', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dna-overlay-'));
    const dnaDir = path.join(root, 'dna');
    fs.mkdirSync(dnaDir, { recursive: true });
    const dna = defineAgent({ name: 'ghost', mission: 'Invisible agent', skills: [] });
    fs.writeFileSync(
      path.join(dnaDir, 'ghost.marketplace.json'),
      JSON.stringify({ name: 'ghost-pack', version: '1.0.0', dna }),
      'utf8'
    );
    const report = await applyDnaOverlays(
      {
        getAgentMetadata: () => undefined,
        hotReloadDna: jest.fn(),
      },
      { projectRoot: root, env: {} as NodeJS.ProcessEnv }
    );
    expect(report.applied).toHaveLength(0);
    expect(report.skipped.some((s) => s.includes('not registered'))).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
