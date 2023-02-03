/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import fileUpload from 'express-fileupload';
import {ExtendedRequest} from '../interfaces';
import {addLearnerByFile, addLearnerByJson} from '../middleware/learner';
import search from '../middleware/learner/search';
import request_body_validation from '../middleware/request_body_validation';
import verify_excel_upload from '../middleware/verify_excel_upload';
import continuing from './learner/continuing';
import admit from './learner/form_1/admit';
import selected from './learner/form_1/selected';
import nhif from './learner/nhif';

const learner = Router();

learner.use('/admit', admit);
learner.use('/nhif', nhif);
learner.use('/selected', selected);
learner.use('/search', search);
learner.use('/continuing', continuing);

learner.put(
	'/',
	fileUpload({
		useTempFiles: true,
		tempFileDir: `${process.cwd()}/uploads/temp/`,
		preserveExtension: true,
		debug: true,
		parseNested: true,
		createParentPath: true
	}),
	verify_excel_upload,
	addLearnerByFile
);

learner.post('/', request_body_validation, addLearnerByJson);

learner.use((req: ExtendedRequest) => {
	if (!['GET', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
		return req.response.error(405, 'Method not allowed', [
			'Only GET, PATCH, PUT, DELETE requests are allowed on this route'
		]);
	}
});

export default learner;
