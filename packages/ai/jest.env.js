/**
 * Runs before module graph loads — mute core winston console/file spam in tests.
 */
process.env.LOG_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';
