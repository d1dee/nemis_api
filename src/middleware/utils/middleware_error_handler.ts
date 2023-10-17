/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { NextFunction, Request, Response } from 'express';

import CustomError from '@libs/error_handler';
import { ZodError } from 'zod';
import { stat } from 'fs';
import { AxiosError } from 'axios';
import { log } from 'console';

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
        let nemisErrorFormat = formatNemisErrors(err);
        message = err?.message;
        statusCode = err?.response?.status || 500;
    }

    if (err instanceof ZodError) {
        statusCode = 422;
        message = `Validation error. ${JSON.stringify(err.flatten().fieldErrors)}`;
    }

    if (err instanceof  SyntaxError){
        // @ts-ignore
        if(err?.body){
            message = err?.message
            // @ts-ignore
            statusCode= err?.statusCode
        }


    }
    // Any other error return an 'Internal server error'
    !statusCode ? (statusCode = 500) : undefined;
    !message ? (message = 'Internal server error, an unknown error has occured.') : undefined;

    return req.sendResponse.error(statusCode, message, cause);
}

const formatNemisErrors = (error: any) => {};
