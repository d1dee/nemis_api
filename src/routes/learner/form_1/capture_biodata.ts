/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import {ExtendedRequest} from '../../../interfaces';
import {
	captureBiodata,
	getCapturedBiodata
} from '../../../middleware/learner/form_1/capture_biodata';

const captureRouter = Router();
captureRouter.use((req: ExtendedRequest, res, next) => {
	let response = req.response;
	if (!['GET', 'POST'].includes(req.method)) {
		return response.error(405, 'Method not allowed', [
			'Only GET, POST, DELETE requests are allowed on this route'
		]);
	}
	next();
});
captureRouter.post('/', captureBiodata);
//captureRouter.post('/', captureRouterLearner);
captureRouter.get('/', getCapturedBiodata);
export default captureRouter;
