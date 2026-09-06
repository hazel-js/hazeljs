/**
 * @hazeljs/organism errors
 */

export class OrganismError extends Error {
  readonly code: string;
  constructor(message: string, code = 'ORGANISM_ERROR') {
    super(message);
    this.name = 'OrganismError';
    this.code = code;
  }
}

export class OrganismLimitError extends OrganismError {
  constructor(message: string) {
    super(message, 'ORGANISM_LIMIT');
    this.name = 'OrganismLimitError';
  }
}

export class OrganismResourceDeniedError extends OrganismError {
  constructor(message: string) {
    super(message, 'ORGANISM_RESOURCE_DENIED');
    this.name = 'OrganismResourceDeniedError';
  }
}

export class OrganismConstitutionError extends OrganismError {
  constructor(message: string) {
    super(message, 'ORGANISM_CONSTITUTION');
    this.name = 'OrganismConstitutionError';
  }
}

export class OrganismStateError extends OrganismError {
  constructor(message: string) {
    super(message, 'ORGANISM_STATE');
    this.name = 'OrganismStateError';
  }
}

export class OrganismNotFoundError extends OrganismError {
  constructor(message: string) {
    super(message, 'ORGANISM_NOT_FOUND');
    this.name = 'OrganismNotFoundError';
  }
}
