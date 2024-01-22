/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { NextFunction, Request } from 'express';

import CustomError from '@libs/error_handler';
import { ZodError } from 'zod';
import { AxiosError } from 'axios';
import { fromZodError } from 'zod-validation-error';

export function sendErrorMessage(req: Request, err: any, next?: NextFunction) {
    // If no error and next is not undefined, call next()
    if (!err && next) next();
    // else handle error
    let statusCode = err?.status || err?.statusCode;

    let message = undefined;
    let cause = process.env.NODE_ENV === 'production' ? undefined : err?.cause ?? err;

    if (err instanceof CustomError) {
        message = err.message;
        statusCode = err.code;
    }

    if (err instanceof AxiosError) {
        message = err?.message;
        statusCode = err?.response?.status || 500;
    }

    if (err instanceof ZodError) {
        statusCode = 422;
        message = fromZodError(err, {
            maxIssuesInMessage: 1
        }).message;
    }

    if (err instanceof SyntaxError) {
        // @ts-ignore
        if (err?.body) {
            message = err?.message;
            // @ts-ignore
            statusCode = err?.statusCode;
        }
    }
    // Any other error return an 'Internal server error'
    !statusCode ? (statusCode = 500) : undefined;
    !message ? (message = err.message || 'Internal server error, an unknown error has occurred.') : undefined;

    return req.respond.sendError(statusCode, message, cause);
}
