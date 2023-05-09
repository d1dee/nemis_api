import { sendErrorMessage } from '../utils/middlewareErrorHandler';
import { Request } from 'express';
import learner from '../../database/learner';
import CustomError from '../../libs/error_handler';
import { CompleteLearner } from '../../../types/nemisApiTypes';
import { uniqueIdentifierSchema } from '../../libs/zod_validation';
import { NemisApiService } from '../../libs/nemis/nemis_api_handler';
import { NemisWebService } from '../../libs/nemis/nemis_web_handler';

const admitJoiningLearner = async (req: Request) => {
	try {
		let learnersToAdmit = await learner
			.find({
				continuing: false, // Only admit joining learners
				institutionId: req.institution._id,
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

		// Initialize NEMIS module and login
		const nemis = new NemisWebService();
		let cookie = await nemis.login(req.institution?.username, req.institution?.password);

		// Use for await of to avoid view state conflict

		let admittedJoiningLearners = await nemis.listAdmittedJoiningLearners();

		if (admittedJoiningLearners.length > 10)
			// Sort by Birth certificate number
			admittedJoiningLearners.sort((a, b) => (a.indexNo > b.indexNo ? 1 : -1));

		let learnersNotAdmitted: typeof learnersToAdmit = [];

		for (const learner of learnersToAdmit) {
			let filteredLearner = admittedJoiningLearners.filter(
				x => learner.indexNo === x.indexNo
			);
			if (filteredLearner.length === 1) {
				learner.admitted = true;
				continue;
			}
			learnersNotAdmitted.push(learner);
		}

		// We update database here to save progress in case of an error
		await Promise.all(
			learnersToAdmit.map(x =>
				x.admitted ? learner.updateOne({ _id: x._id }, x) : Promise.resolve()
			)
		);

		if (learnersNotAdmitted.length === 0) {
			req.sendResponse.respond(learnersToAdmit, 'All learners are already admitted.');
			return;
		}

		// Send cookie to be used to initialize new nemis instance for each leanerWithoutUpi
		let admissionResults = await Promise.allSettled(
			learnersNotAdmitted.map(x => admitLearner(new NemisWebService(cookie), x))
		);
		admissionResults.map((x, i) => {
			if (x.status === 'rejected') {
				learnersNotAdmitted[i].admitted = false;
				if (x.reason instanceof CustomError) {
					learnersNotAdmitted[i].error = x.reason.message;
				} else {
					learnersNotAdmitted[i].error = x.reason.message || 'Unknown error';
				}
			} else {
				learnersNotAdmitted[i].admitted = x.value;
				learnersNotAdmitted[i].error = undefined;
			}
		});

		await Promise.all(
			learnersNotAdmitted.map(x =>
				x.admitted ? learner.updateOne({ _id: x._id }, x) : Promise.resolve()
			)
		);

		req.sendResponse.respond(learnersNotAdmitted);
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
			institutionId: req.institution._id,
			indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
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
		const nemis = new NemisWebService();
		await nemis.login(req.institution?.username, req.institution?.password);

		let admissionResults = await Promise.allSettled([admitLearner(nemis, learnerToAdmit)]);

		if (admissionResults[0].status === 'rejected') {
			learnerToAdmit.admitted = false;
			if (admissionResults[0].reason instanceof CustomError) {
				learnerToAdmit.error = admissionResults[0].reason.message;
			} else {
				learnerToAdmit.error = admissionResults[0].reason.message || 'Unknown error';
			}
		} else {
			learnerToAdmit.admitted = admissionResults[0].value;
			learnerToAdmit.error = undefined;
		}

		await learner.updateOne({ _id: learnerToAdmit._id }, learnerToAdmit);

		req.sendResponse.respond(learnerToAdmit);
		return;
	} catch (err) {
		sendErrorMessage(req, err);
	}
};

const admitLearner = async (nemis: NemisWebService, learner: CompleteLearner) => {
	try {
		if (!learner?.indexNo) {
			throw new CustomError(
				'Learner has no index number. Please update learner to include an index number',
				400
			);
		}

		let admitApiResponse = await new NemisApiService().admitApiCalls(learner.indexNo);

		// Extract all parsed data returned by the api
		const { admission, reported, captured } = admitApiResponse;

		if (admission instanceof CustomError) {
			throw admission;
		}
		// Check how closely admitApiResponse matches to our learner
		if (admission.gender !== learner.gender) {
			throw new CustomError(
				"Learner's gender doesn't match up with that returned by the nemis API. Check index number",
				401
			);
		}

		let matchedName = learner.name
			.match(new RegExp(admission.name?.replaceAll(' ', '|'), 'gi'))
			?.filter(x => !!x);

		if (!matchedName) {
			throw new CustomError('learner has no matching name to that returned by the Api', 400);
		}

		// if we matched more than one name skip checking marks
		if (matchedName.length < 2)
			if (admission.marks && admission?.marks !== String(learner.marks)) {
				throw new CustomError("Learner's marks saved in the data", 400);
			}

		// Check if learner is admitted elsewhere
		let reportedCaptured =
			captured instanceof CustomError
				? reported instanceof CustomError
					? undefined
					: reported
				: captured;

		if (reportedCaptured) {
			// If admitted to another institution, check if learner is already captured
			if (reportedCaptured.upi && reportedCaptured?.upi?.length > 3) {
				throw new CustomError(
					`Learner has already been admitted and captured at ${reportedCaptured.capturedBy}, ${reportedCaptured.institution.name}`,
					400
				);
			}
		}

		// We can go ahead and admit if we haven't failed yet
		return nemis.admitJoiningLearner({
			...admission,
			mother: learner.mother,
			father: learner.father,
			guardian: learner.guardian,
			adm: learner.adm
		});
	} catch (err) {
		throw err;
	}
};

export { admitJoiningLearner, admitSingleJoiningLearner };
