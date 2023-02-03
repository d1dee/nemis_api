/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import {ExtendedRequest} from '../../../interfaces';
import {
	getRequestedLearner,
	getSelectedLearners,
	requestAdmission
} from '../../../middleware/learner/form_1/selected';
import request_body_validation from '../../../middleware/request_body_validation';

const selected = Router();

selected.get('/', getSelectedLearners);

selected.post('/request', request_body_validation, requestAdmission);
selected.get('/request', getRequestedLearner);

selected.use((req: ExtendedRequest, res, next) => {
	let response = req.response;
	if (!['GET'].includes(req.method)) {
		return response.error(405, 'Method not allowed', [
			'Only GET requests are allowed on this route'
		]);
	}
	next();
});

export default selected;
