import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODE, type ErrorCode } from '@lucidkit/types';

const HTTP_STATUS_TO_ERROR_CODE: Partial<Record<HttpStatus, ErrorCode>> = {
    [HttpStatus.BAD_REQUEST]: ERROR_CODE.VALIDATION_ERROR,
    [HttpStatus.UNAUTHORIZED]: ERROR_CODE.UNAUTHORIZED,
    [HttpStatus.NOT_FOUND]: ERROR_CODE.NOT_FOUND,
    [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODE.VALIDATION_ERROR,
    [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODE.RATE_LIMIT_EXCEEDED,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.message
                : 'Internal server error';

        const code =
            HTTP_STATUS_TO_ERROR_CODE[status as HttpStatus] ??
            ERROR_CODE.INTERNAL_ERROR;

        if (status >= 500) {
            this.logger.error(
                message,
                exception instanceof Error ? exception.stack : undefined
            );
        }

        response.status(status).json({
            error: {
                code,
                message,
            },
        });
    }
}
