import { sendErrorMessage } from '../utils/middlewareErrorHandler';
import { Request } from 'express';
import { GRADES, uniqueIdentifierSchema } from '../../libs/zod_validation';
import { z as zod } from 'zod';
import learner from '../../database/learner';
import CustomError from '../../libs/error_handler';

const deleteBulkLearner = async (req: Request) => {
	try {
		let grade = zod.enum(GRADES).parse(req.params?.grade);
		let learnersToArchive = await learner.find({
			grade: grade,
			archived: false,
			institutionId: req.institution._id
		});
		if (!learnersToArchive) {
			throw new CustomError(
				'No active learners found in the provided grade.' +
					'Please check that the provided grade is correct or enroll learners in the given grade.',
				404,
				'not_found'
			);
		}
		let archivedLearner = await Promise.all(
			learnersToArchive.map(x =>
				learner.findByIdAndUpdate(x._id, { archived: true }, { returnDocument: 'after' })
			)
		);
		req.sendResponse.respond(archivedLearner, 'This learners were successfully archived.');
	} catch (err) {
		sendErrorMessage(req, err);
	}
};
const deleteSingleLearner = async (req: Request) => {
	try {
		let uniqueIdentifier = uniqueIdentifierSchema.parse(req.params?.uniqueIdentifier);

		let archivedLearner = await learner.findOneAndUpdate(
			{
				institutionId: req.institution._id,
				$or: [
					{ upi: uniqueIdentifier },
					{ birthCertificateNo: uniqueIdentifier },
					{ adm: uniqueIdentifier }
				]
			},
			{ archived: true },
			{ returnDocument: 'after' }
		);
		if (!archivedLearner) {
			throw new CustomError(
				'No active learner found in the provided uniqueIdentifier.' +
					'Please check that the provided uniqueIdentifier is correct or enroll learners to the database.',
				404,
				'not_found'
			);
		}
		req.sendResponse.respond(archivedLearner, 'This learners were successfully archived.');
	} catch (err) {
		sendErrorMessage(req, err);
	}
};
export { deleteBulkLearner, deleteSingleLearner };
