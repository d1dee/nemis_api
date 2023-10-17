/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { NextFunction, Request, Response } from 'express';
import { sendErrorMessage } from './middleware_error_handler';
import { z as zod } from 'zod';

const queryParameterSchema = zod.object({
	transfer: zod
		.enum(['true', 'false'])
		.transform(x => x === 'true')
		.optional()
});

const queryParametersMiddleware = (req: Request, res: Response, next: NextFunction) => {
	try {
		req.queryParams = queryParameterSchema.parse(req.query);
		next();
	} catch (err) {
		sendErrorMessage(req, err);
	}
};

export { queryParametersMiddleware, queryParameterSchema };
