/** Mute @hazeljs/core winston during tests (must run before module load). */
process.env.LOG_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';
