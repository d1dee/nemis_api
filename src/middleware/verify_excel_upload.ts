/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {NextFunction, Response} from 'express';
import {UploadedFile} from 'express-fileupload';
import {ExtendedRequest} from '../interfaces';

export default (req: ExtendedRequest, res: Response, next: NextFunction) => {
	try {
		if (!req.files)
			throw {
				code: 400,
				message: 'Bad request. No file received.',
				cause: [
					'This end points expects a multi-part upload with an Excel file.' +
					req.headers['content-type'] +
					' Content type is not supported'
				]
			};
		if (typeof req.files === 'object' && Object.keys(req.files).length < 1)
			throw {
				code: 400,
				message: 'Bad request',
				cause: ['This end points expects a multi-part upload with an Excel file.']
			};

		if (Object.keys(req.files).length !== 1)
			throw {
				code: 400,
				message: 'Only one file per upload is allowed.',
				cause: ['Multiple files were uploaded, ' + 'upload only one file at a time.']
			};
		// Select the first file in the req.files object
		const file: UploadedFile | UploadedFile[] = req.files[Object.keys(req.files)[0]];

		if (Array.isArray(file)) {
			throw {
				code: 400,
				message: 'Invalid file was uploaded.',
				cause: ['file is an array, expected and object']
			};
		}
		// Verify if file mimetype corresponds to Excels mimetype
		if (
			![
				'application/vnd.ms-excel',
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			].includes(file.mimetype)
		) {
			throw {
				code: 400,
				message: 'Invalid mimetype',
				cause: [
					`Uploaded file mimetype is ${file.mimetype}, expected 'application/vnd.ms-excel' or 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`
				]
			};
		}
		if (file.size > 1e7) {
			throw {
				code: 413,
				message: 'Uploaded file is too large',
				cause: [`Only files less than 10MB are allowed`]
			};
		}
		if (
			[
				'application/vnd.ms-excel.sheet.macroEnabled.12',
				'application/vnd.ms-excel.template.macroEnabled.12',
				'application/vnd.ms-excel.addin.macroEnabled.12',
				'application/vnd.ms-excel.sheet.binary.macroEnabled.12'
			].includes(file.mimetype)
		) {
			throw {
				code: 400,
				message: 'Excels with macros are unsupported',
				cause: ['An excel file containing a macro was received.']
			};
		}
		// Move files to institutions specific folder
		let path = process.cwd() + `/uploads/${req.institution.username}/${
			file.name
		}_${new Date().toDateString()}`.replace(' ', '_');
		file.mv(path, err => {
			if (err) {
				throw {code: 500, message: 'Error while saving file.', cause: [err]};
			} else {
				req.body.file = path;
				next();
			}
		});
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
