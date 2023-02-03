/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import {ExtendedRequest} from '../../interfaces';
import {getNhif, submitNhif} from '../../middleware/learner/nhif';

const nhif = Router();

nhif.post('/', submitNhif);
nhif.get('/', getNhif);

nhif.use((req: ExtendedRequest, res, next) => {
	let response = req.response;
	if (!['GET', 'DELETE', 'POST'].includes(req.method)) {
		return response.error(405, 'Method not allowed', [
			'Only GET, POST, DELETE requests are allowed on this route'
		]);
	}
	next();
});

export default nhif;