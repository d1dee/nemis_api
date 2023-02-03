/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {json, Router} from 'express';
import {ExtendedRequest} from '../interfaces';
import {deleteInstitution, getInstitution, updateInstitution} from '../middleware/institution';

const institution = Router().use(json());

institution.get('/', getInstitution);
institution.patch('/', updateInstitution);
institution.delete('/', deleteInstitution);
institution.use((req: ExtendedRequest, res, next) => {
	let response = req.response;
	if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
		return response.error(405, 'Method not allowed', [
			'Only GET,PATCH,DELETE requests are allowed on this route'
		]);
	}
	next();
});

export default institution;
/**
/institution (get for info, post for create, put for update, delete for delete)✅
    /list
        /admitted
        /transfer_out
        /transfer_in
    /issues (with specific filters)
        /search
**/