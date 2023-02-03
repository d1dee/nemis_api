/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
// @ts-nocheck
import {NextFunction, Response} from 'express';

import {ExtendedRequest} from '../interfaces';

export default async (err, req: ExtendedRequest, res: Response, next: NextFunction) => {
	if (!err) return next();
	try {
		if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
			res.status(err.statusCode || 400).json({
				success: false,
				message: err.message,
				cause: {
					errorType: err.type,
					body: err.body
				}
			});
		} else {
			res.status(400).json({
				success: false,
				message: err.message || 'Invalid data received',
				cause: err
			});
		}
	} catch (err) {
		next(err);
	}
};
