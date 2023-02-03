/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import {ExtendedRequest} from '../../interfaces';
import {
	addContinuingLearner,
	captureContinuingLearner,
	deleteContinuingLearner,
	getContinuingLearner
} from '../../middleware/learner/continuing';

const continuing = Router();
continuing.use((req: ExtendedRequest, res, next) => {
	let response = req.response;
	if (!['GET', 'DELETE', 'POST'].includes(req.method)) {
		return response.error(405, 'Method not allowed', [
			'Only GET, POST, DELETE requests are allowed on this route'
		]);
	}
	next();
});

// get learners pending continuing learners awaiting approval
continuing.get('/', getContinuingLearner);
//add continuing learner using post
continuing.post('/', addContinuingLearner);
continuing.post('/', deleteContinuingLearner);
continuing.post('/capture', captureContinuingLearner);
export default continuing;
