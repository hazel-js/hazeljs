/**
 * Event emitter configuration options (passed to eventemitter2)
 */
export interface EventEmitterModuleOptions {
  /**
   * Use wildcards for event names (e.g. 'order.*')
   * @default false
   */
  wildcard?: boolean;

  /**
   * Delimiter used to segment namespaces
   * @default '.'
   */
  delimiter?: string;

  /**
   * Emit newListener event when adding listeners
   * @default false
   */
  newListener?: boolean;

  /**
   * Emit removeListener event when removing listeners
   * @default false
   */
  removeListener?: boolean;

  /**
   * Maximum number of listeners per event
   * @default 10
   */
  maxListeners?: number;

  /**
   * Show event name in memory leak message
   * @default false
   */
  verboseMemoryLeak?: boolean;

  /**
   * Disable throwing uncaughtException if error event has no listeners
   * @default false
   */
  ignoreErrors?: boolean;
}

/**
 * Options for @OnEvent decorator
 */
export interface OnEventOptions {
  /**
   * If true, listener runs asynchronously
   * @default false
   */
  async?: boolean;

  /**
   * If true, prepends listener instead of appending
   * @default false
   */
  prependListener?: boolean;

  /**
   * If true, errors in the handler are suppressed (not rethrown)
   * @default true
   */
  suppressErrors?: boolean;
}
