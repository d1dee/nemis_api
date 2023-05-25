/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from 'express';
import learner from '../../database/learner';
import { validateExcel, validateLearnerJson } from '../../libs/import_excel';
import CustomError from '../../libs/error_handler';
import { sendErrorMessage } from '../utils/middlewareErrorHandler';

const addLearnerByFile = async (req: Request) => {
	try {
		// If for some reason the file path wasn't passed
		if (!Object.hasOwn(req.body, 'file')) {
			throw new CustomError('Invalid request. No file was uploaded.' +
				'Please upload an Excel file using multi-part upload.', 400);
		}
		// Validate requested file
		let validatedExcel = validateExcel(req.body.file);
		let validationError = validatedExcel.filter(x => !!x.validationError);
		if (validationError.length > 0) {
			throw new CustomError('Validation error.' +
				'One or more fields failed validation. Please check the following errors', 400, 'validation_error', validationError);
		}
		let insertedDocs = await Promise.all(validatedExcel.map(x =>
			learner.findOneAndUpdate({ adm: x.adm },
				{
					...x,
					institutionId: req.institution._id,
					continuing: x.continuing ? x.continuing : (req.url === '/continuing/excel'),
					archived: false
				},
				{
					upsert: true,
					returnDocument: 'after'
				}
			)
		));

		return req.sendResponse.respond(
			insertedDocs,
			insertedDocs?.length + ' learners were successful added to the database.'
		);
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};

const addLearnerByJson = async (req: Request) => {
	try {
		// Validate requested learner
		let validatedLearner = validateLearnerJson(req.body);

		if (validatedLearner?.validationError) {
			throw new CustomError('Validation error. ' +
				'One or more fields failed validation. Please check the following errors', 400, 'validation_error', validatedLearner);
		}
		let insertedDocs = await learner.findOneAndUpdate({ adm: { $eq: validatedLearner.adm } },
			{
				...validatedLearner,
				institutionId: req.institution._id,
				continuing: validatedLearner.continuing ? validatedLearner.continuing : (req.url === '/continuing/excel'),
				archived: false
			},
			{
				upsert: true,
				returnDocument: 'after'
			}
		);

		return req.sendResponse.respond(
			insertedDocs,
			insertedDocs.name + ', ' + insertedDocs.adm + ' was successfully added to the database.'
		);
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};

export { addLearnerByFile, addLearnerByJson };
