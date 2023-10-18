/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from 'express';
import { sendErrorMessage } from '@middleware/utils/middleware_error_handler';
import learner from '@database/learner';
import CustomError from '@libs/error_handler';
import { z as zod } from 'zod';

const searchLearner = async (req: Request) => {
	try {
		let uniqueIdentifier = zod
			.string({
				required_error:
					'Unique identifier missing.To delete a learner, a unique identifier must be provided. The identifier can be either the UPI, birth certificate number, or admission number.',
				invalid_type_error: ' Unique identifier must be a string.'
			}).max(15,' expected a string of less than 15 characters.')
			.parse(req.params?.uniqueIdentifier);

		let searchLearner = await learner.findOne({
			institutionId: req.institution._id,
			$or: [
				{ upi: uniqueIdentifier },
				{ birthCertificateNo: uniqueIdentifier },
				{ adm: uniqueIdentifier }
			]
		});
		if (!searchLearner) {
			throw new CustomError(
				'No active learner found with the provided uniqueIdentifier.' +
					'Please check that the provided uniqueIdentifier is correct or enroll learners to the database.',
				404,
				'not_found'
			);
		}
		req.sendResponse.respond(
			searchLearner,
			(searchLearner.archived ? 'An archived learner ' : 'Learner ') +
				'with the provided unique identifier was found.'
		);
	} catch (err) {
		sendErrorMessage(req, err);
	}
};

export { searchLearner };
