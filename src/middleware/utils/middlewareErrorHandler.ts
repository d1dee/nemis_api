/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
// @ts-nocheck
import { NextFunction, Request, Response } from 'express';

import CustomError from '../../libs/error_handler';
import { ZodError } from 'zod';

export default async (err, req: Request, res: Response, next: NextFunction) => {
	if (!err) return next();
	try {
		if (err instanceof SyntaxError && 'body' in err) {
			res.status(err.status || 400).json({
				success: false,
				message: err.message,
				cause: {
					errorType: err.type,
					body: err.body
				}
			});
		} else {
			res.status(
				err?.status && err?.status < 510 && err?.status >= 400 ? err.status : 400
			).json({
				success: false,
				message: err.message || 'Invalid data received',
				cause: err
			});
		}
	} catch (err) {
		next(err);
	}
};

export function sendErrorMessage(req: Request, err: any) {
	if (err instanceof CustomError)
		return req.sendResponse.error(
			err.code,
			err?.message,
			err.cause || {
				type: err?.type || 'unknown',
				//message: err?.message || 'unknown',
				stack: err?.stack || 'undefined'
			}
		);
	if (err instanceof ZodError)
		return req.sendResponse.error(422, 'Validation error', err.flatten().fieldErrors);
	// Any other error return an 'Internal server error'
	return req.sendResponse.error(
		500,
		err.message || 'Internal server error. An unhandled error has been encountered.',
		err.cause || { stack: err?.stack }
	);
}
