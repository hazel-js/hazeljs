import { Command } from 'commander';
import { registerAgentCommand } from './agent';

describe('registerAgentCommand (AOS-011)', () => {
  it('registers run, logs, and doctor subcommands', () => {
    const program = new Command();
    registerAgentCommand(program);
    const agent = program.commands.find((c) => c.name() === 'agent');
    expect(agent).toBeDefined();
    const names = agent!.commands.map((c) => c.name());
    expect(names).toEqual(
      expect.arrayContaining(['install', 'dna', 'run', 'logs', 'doctor', 'runs'])
    );
  });
});
