import { jest } from '@jest/globals';
import logger from '@hazeljs/core';
import winston from 'winston';

// Configure winston logger for tests
logger.configure({
  level: 'error',
  transports: [
    new winston.transports.Console({
      silent: true,
    }),
  ],
});

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'debug').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
