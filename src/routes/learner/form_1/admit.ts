/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import {ExtendedRequest} from '../../../interfaces';
import {
	admitDatabaseJoiningLearners,
	admitJsonLearner,
	getAdmittedLearner
} from '../../../middleware/learner/form_1/admit';
import request_body_validation from '../../../middleware/request_body_validation';
import capture_biodata from './capture_biodata';

const admit = Router();

admit.use('/capture', capture_biodata);
admit.use((req: ExtendedRequest, res, next) => {
	let response = req.response;
	if (!['GET', 'DELETE', 'POST'].includes(req.method)) {
		return response.error(405, 'Method not allowed', [
			'Only GET, POST, DELETE requests are allowed on this route'
		]);
	}
	if (req.path === '/new' && req.method !== 'POST')
		return response.error(405, 'Only POST method is allowed' + ' on this endpoint');
	next();
});
admit.post('/', admitDatabaseJoiningLearners);
admit.post('/new', request_body_validation, admitJsonLearner);
//admit.post('/', admitLearner);
admit.get('/', getAdmittedLearner);
export default admit;
