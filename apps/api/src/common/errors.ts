import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Claves de error que la app traduce con ngx-translate.
 *
 * Se conservan las del backend anterior en Lumen para que los archivos de
 * traducción existentes (`assets/i18n/*.json`) sigan siendo válidos.
 */
export const ErrorCode = {
  Unauthorized: 'SERVER.UNAUTHORIZED',
  NotEnoughRights: 'SERVER.NOT_ENOUGH_RIGHTS',
  NoSession: 'SERVER.NO_SESION',
  BadToken: 'SERVER.BAD_TOKEN',
  WrongToken: 'SERVER.WRONG_TOKEN',

  IncorrectUser: 'SERVER.INCORRECT_USER',
  WrongUser: 'SERVER.WRONG_USER',
  UserNotRegistered: 'SERVER.USER_NOT_REGISTRED',
  UserAlreadyExists: 'SERVER.USER_ALREADY_EXISTS',
  EmailNotFound: 'SERVER.EMAIL_NOT_FOUND',
  EmailReady: 'SERVER.EMAIL_READY',
  UserSocialAlreadyUsed: 'SERVER.USER_SOCIAL_ALREADY_USED',
  WrongSocialLinkId: 'SERVER.WRONG_SOCIAL_LINK_ID',
  SocialLinkDeleted: 'SERVER.SOCIAL_LINK_DELETED',

  NotFound: 'SERVER.NOT_FOUND',
  ValidationFailed: 'SERVER.VALIDATION_FAILED',
  Conflict: 'SERVER.CONFLICT',
  TooManyRequests: 'SERVER.TOO_MANY_REQUESTS',
  DatabaseUnavailable: 'SERVER.DATABASE_UNAVAILABLE',
  OutOfStock: 'SERVER.OUT_OF_STOCK',
  PaymentFailed: 'SERVER.PAYMENT_FAILED',
  UnsupportedMedia: 'SERVER.UNSUPPORTED_MEDIA',
  FileTooLarge: 'SERVER.FILE_TOO_LARGE',
  Error: 'SERVER.ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Excepción de dominio. A diferencia de las de Nest, lleva siempre una clave
 * `code` traducible, que es lo que la app muestra al usuario; `message` queda
 * en inglés para los registros del servidor.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super({ code, message, errors }, status);
  }

  static unauthorized(message = 'Authentication required'): AppException {
    return new AppException(ErrorCode.Unauthorized, HttpStatus.UNAUTHORIZED, message);
  }

  static invalidCredentials(): AppException {
    return new AppException(
      ErrorCode.IncorrectUser,
      HttpStatus.UNAUTHORIZED,
      'Email or password is incorrect',
    );
  }

  static forbidden(message = 'Insufficient permissions'): AppException {
    return new AppException(ErrorCode.NotEnoughRights, HttpStatus.FORBIDDEN, message);
  }

  static notFound(resource: string): AppException {
    return new AppException(ErrorCode.NotFound, HttpStatus.NOT_FOUND, `${resource} not found`);
  }

  static conflict(code: ErrorCode, message: string): AppException {
    return new AppException(code, HttpStatus.CONFLICT, message);
  }

  static badRequest(code: ErrorCode, message: string, errors?: Record<string, string[]>): AppException {
    return new AppException(code, HttpStatus.BAD_REQUEST, message, errors);
  }

  static badToken(message = 'The token is invalid or has expired'): AppException {
    return new AppException(ErrorCode.BadToken, HttpStatus.BAD_REQUEST, message);
  }
}
