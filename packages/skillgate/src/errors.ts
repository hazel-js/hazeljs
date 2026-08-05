/**
 * Skillgate errors
 */

export class SkillgateError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'SkillgateError';
  }
}

export class SkillgateConfigError extends SkillgateError {
  constructor(message: string) {
    super(message, 'SKILLGATE_CONFIG');
    this.name = 'SkillgateConfigError';
  }
}

export class SkillgateSsrfError extends SkillgateError {
  constructor(message: string) {
    super(message, 'SKILLGATE_SSRF');
    this.name = 'SkillgateSsrfError';
  }
}
