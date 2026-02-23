/**
 * Manual mock for @hazeljs/core - provides no-op logger for tests
 * Must re-export all actual exports so Injectable, Container, etc. work
 */
const actual = jest.requireActual('@hazeljs/core');
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  isDebugEnabled: jest.fn().mockReturnValue(false),
};
// Preserve all actual exports, only override default (logger)
module.exports = Object.assign({}, actual, { default: mockLogger });
