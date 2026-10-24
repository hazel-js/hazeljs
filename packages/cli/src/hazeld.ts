#!/usr/bin/env node
/**
 * hazeld — long-lived HazelJS Agent OS node (survives terminal close).
 */

import { runHazeldMain } from '@hazeljs/agent';

const projectRoot = process.env.HAZEL_PROJECT_ROOT ?? process.cwd();

runHazeldMain({
  home: process.env.HAZEL_HOME,
  projectRoot,
  useProjectStore: true,
}).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
