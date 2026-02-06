export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors?: string[]
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string, errors?: string[]) {
    super(400, message, errors);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = 'Not Found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends HttpError {
  constructor(message: string = 'Internal Server Error') {
    super(500, message);
    this.name = 'InternalServerError';
  }
}

// Aliases using Exception naming convention (matches documentation)
export const HttpException = HttpError;
export const BadRequestException = BadRequestError;
export const UnauthorizedException = UnauthorizedError;
export const ForbiddenException = ForbiddenError;
export const NotFoundException = NotFoundError;
export const ConflictException = ConflictError;
export const InternalServerErrorException = InternalServerError;
