import { Request, Response } from 'express';
import CustomError from '../../libs/error_handler';
import learner from '../../database/learner';
import { CaptureBiodataResponse, Grades, ListLearner } from '../../../types/nemisApiTypes';

const syncLearner = async (req: Request, response: Response) => {
	try {
		/**
		 * get all learner from nemis
		 * get all learners without upi
		 * match them up
		 * update db
		 */

		//let institutionLevel = req.institution.level;

		// call Sync db to update our local database
		// Get continuing learners to capture
		let continuingLearners = await learner
			.find({
				$and: [
					{ continuing: true },
					{ archived: false },
					{ birthCertificateNo: { $type: 'string' } },
					{ upi: { $in: [0, null, ''] } }
				]
			})
			.lean();
		if (!continuingLearners || !Array.isArray(continuingLearners)) {
			throw new CustomError('No continuing learners in the database', 403);
		}
		// Get all grades to query list learner
		let listGrades = [...new Set(continuingLearners.map(x => x.grade))];
		let listLearner: { [K in Grades]?: ListLearner[] } = {};
		// we can't use Promise.all because NEMIS does keep a state. Return a list learner array sorted by birth certificate numbers
		for await (const grade of listGrades) {
			Object.assign(listLearner, {
				[grade]: (await req.nemis.listLearners(grade as Grades)).sort((a, b) =>
					a.birthCertificateNo.localeCompare(b.birthCertificateNo)
				)
			});
		}
		// Check if any of the continuing learners has a UPI number
		//console.time("matching_learner_to_upi");

		for (let i = 0; i < continuingLearners.length; i++) {
			let gradeListLearner = listLearner[continuingLearners[i].grade];
			if (!gradeListLearner || !Array.isArray(gradeListLearner)) {
				continue;
			}
			let foundLearnerUpi = gradeListLearner.find(
				x => continuingLearners[i].birthCertificateNo === x.birthCertificateNo
			);
			if (foundLearnerUpi) {
				Object.assign(continuingLearners[i], {
					...continuingLearners[i],
					upi: foundLearnerUpi.upi,
					error: null
				});
			}
		}

		let captureBiodataPromises = await Promise.allSettled(
			continuingLearners.map(x =>
				!x?.upi
					? req.nemis.addContinuingLearner(x)
					: <CaptureBiodataResponse>{
							upi: x?.upi,
							message: 'already captured',
							alertMessage: undefined
					  }
			)
		);
	} catch (err: any) {
		req.sendResponse.error(
			err instanceof CustomError ? err.code : 500,
			err instanceof CustomError ? err.message : 'Internal server error'
		);
	}
};
export default syncLearner;