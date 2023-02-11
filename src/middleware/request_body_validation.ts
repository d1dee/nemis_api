/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
import {NextFunction, Response} from 'express';
import {ExtendedRequest} from '../interfaces';
import {
	validateCaptureRequest,
	validateLearnerJson,
	validateRequestingLearner
} from '../libs/import_excel';
import {RequestingLearner} from './interfaces';

export default async (req: ExtendedRequest, res: Response, next: NextFunction) => {
	try {
		const paths = [
			'/api/learner',
			'/api/learner/continuing',
			'/api/learner/continuing/capture',
			'/api/learner/selected/request',
			'/api/learner/admit/new'
		];
		if (req.method != 'POST') return next();
		if (!paths.includes(req.path)) return next();

		if (!Array.isArray(req.body)) throw {code: 400, message: 'request.body is not an Array'};
		// Filter not an array of object
		if (req.body.length === 0 || !req.body.every(x => typeof x === 'object'))
			throw {code: 400, message: 'request.body is not an Array of objects'};
		if ('/api/learner/continuing' === req.path) {
			// validate request learners
			req.body = <RequestingLearner[]>validateRequestingLearner(req.body);
			return next();
		}
		// Parse req.body to make sure it is compliant. Each path has expected data type
		if (
			['/api/learner/continuing/capture', '/api/learner', '/api/learner/admit/new'].includes(
				req.path
			)
		) {
			// paths that receive learner data
			let validateLearners = validateLearnerJson(req.body);
			if (validateLearners.invalidDataObject.length > 0) {
				throw {
					code: 400,
					message: 'Following errors were encountered while validating' + ' learner',
					cause: validateLearners.invalidDataObject
				};
			}
			req.body = validateLearners.validDataObject;
			return next();
		}
		if ('/api/learner/selected/request' === req.path) {
			req.body = validateCaptureRequest(req.body);
			return next();
		}
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
