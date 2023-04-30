import { sendErrorMessage } from '../utils/middlewareErrorHandler';
import { Request } from 'express';
import learner from '../../database/learner';
import CustomError from '../../libs/error_handler';
import { CompleteLearner, Grades, ListLearner } from '../../../types/nemisApiTypes';
import { uniqueIdentifierSchema } from '../../libs/zod_validation';
import { Nemis } from '../../libs/nemis';

const admitJoiningLearner = async (req: Request) => {
	try {
		let learnersToAdmit = await learner
			.find({
				continuing: false, // Only admit joining learners
				upi: { $in: [null, undefined, 0, ''] },
				indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
				admitted: { $in: [null, false] },
				archived: false
			})
			.sort({ birthCertificateNo: 'asc' })
			.lean();

		// Learner to admit should be an array of learners or an empty array if no learner is found
		if (Array.isArray(learnersToAdmit) && learnersToAdmit.length === 0) {
			throw new CustomError(
				'There are no valid learners to admit. Please add learners to the database before continuing.',
				400,
				'no_valid_learner_to_admit'
			);
		}
		// Get specific grades to query from NEMIS
		let listGrades = [...new Set(learnersToAdmit.map(x => x.grade))];

		// Initialize NEMIS module and login
		const nemis = new Nemis();
		await nemis.login(req.institution?.username, req.institution?.password);

		let listLearner: { [K in Grades]?: ListLearner[] } = {};
		// Use for await of to avoid view state conflict
		for await (const grade of listGrades) {
			let nemisListLearners = await nemis.listLearners(grade);
			if (Array.isArray(nemisListLearners) && nemisListLearners.length !== 0) {
				// Sort by Birth certificate number
				listLearner[grade] = nemisListLearners.sort((a, b) =>
					a.birthCertificateNo > b.birthCertificateNo ? 1 : -1
				);
				continue;
			}
			listLearner[grade] = undefined;
		}

		const learnersWithoutUpi: typeof learnersToAdmit = [];

		// Assign leaner upi numbers if they are already capture on the NEMIS website
		let listLearnerGrade: ListLearner[] | undefined = undefined;
		// If we only have on grade, set learner grade
		if (listGrades.length === 1) {
			listLearnerGrade = listLearner[listGrades[0]];
		}
		for (const learner of learnersToAdmit) {
			if (!listLearnerGrade) {
				listLearnerGrade = listLearner[learner.grade];
				if (!Array.isArray(listLearnerGrade) || listLearnerGrade.length === 0) {
					learner.error = 'Failed to fetch list of all admitted learners in this grade';
					continue;
				}
			}
			let filteredLearner = listLearnerGrade.filter(
				x => learner.birthCertificateNo === x.birthCertificateNo
			);
			if (filteredLearner.length === 1) {
				learner.upi = filteredLearner[0].upi;
				learner.nhifNo = filteredLearner[0].nhifNo;
				learner.admitted = true;
				learner.reported = !!filteredLearner[0].upi;
				continue;
			}
			if (filteredLearner.length > 1) {
				learner.error = 'Learner has been captured more than once.';
			}
			learnersWithoutUpi.push(learner);
		}
		// We update database here to save progress in case of an error
		await Promise.all(
			learnersToAdmit.map(x =>
				x.reported ? learner.updateOne({ _id: x._id }, x) : Promise.resolve()
			)
		);
		if (learnersWithoutUpi.length > 0) {
			await admitLearner(nemis, learnersWithoutUpi[0]);
		}
		req.sendResponse.respond(learnersToAdmit, 'All learners are already admitted.');
		return;
	} catch (err) {
		sendErrorMessage(req, err);
	}
};

const admitSingleJoiningLearner = async (req: Request) => {
	try {
		let uniqueIdentifier = uniqueIdentifierSchema.parse(req.params?.uniqueIdentifier);

		let learnerToAdmit = await learner.findOne({
			$or: [{ birthCertificateNo: uniqueIdentifier }, { adm: uniqueIdentifier }],
			indexNo: { $nin: [null, undefined, 0, ''] }, /// Learner must have an index number
			continuing: false,
			archived: false
		});
		if (!learnerToAdmit || typeof learnerToAdmit !== 'object') {
			throw new CustomError(
				'There are no valid learners to admit. Please add learners to the database before continuing.',
				400,
				'no_valid_learner_to_admit'
			);
		}
		if (learnerToAdmit.admitted) {
			req.sendResponse.respond(learnerToAdmit, 'Learner has already been admitted.');
			return;
		}

		// Initialize NEMIS module and login
		const nemis = new Nemis();
		await nemis.login(req.institution?.username, req.institution?.password);

		await admitLearner(nemis, learnerToAdmit);
	} catch (err) {
		sendErrorMessage(req, err);
	}
};

const admitLearner = async (nemis: Nemis, learner: CompleteLearner) => {
	try {
		if (!learner?.indexNo) {
			throw new CustomError(
				'Learner has no index number. Please update learner to include an index number',
				400
			);
		}
		let admitApiResponse = await nemis.admitApiCalls(learner.indexNo);
		console.log(admitApiResponse);
	} catch (err) {
		throw err;
	}
};

export { admitJoiningLearner, admitSingleJoiningLearner };
