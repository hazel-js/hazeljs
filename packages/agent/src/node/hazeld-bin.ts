#!/usr/bin/env node
/**
 * hazeld binary entry (also re-exported from @hazeljs/cli).
 */

import { runHazeldMain } from './hazeld-server';

const projectRoot = process.env.HAZEL_PROJECT_ROOT ?? process.cwd();

runHazeldMain({
  home: process.env.HAZEL_HOME,
  projectRoot,
  useProjectStore: true,
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
