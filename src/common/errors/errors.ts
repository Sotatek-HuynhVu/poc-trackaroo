export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super('VALIDATION_ERROR', 400, message);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('AUTH_ERROR', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', 404, message);
  }
}

export class SurvivalDataRejectedError extends AppError {
  constructor() {
    super('RT05_SURVIVAL_DATA_REJECTED', 400, 'Survival data rejected per RT-05');
  }
}
