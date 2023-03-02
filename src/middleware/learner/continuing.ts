/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
import learner from '../../database/learner';
import {ExtendedRequest, NemisLearnerFromDb} from '../../interfaces';
import {ContinuingLearnerApiResponse} from '../../libs/interface';
import {RequestingLearner} from '../interfaces';

const getContinuingLearner = async (req: ExtendedRequest) => {
	try {
		let requestedContinuingLearner = await req.nemis.getRequestedContinuingLearners();
		let approvedContinuingLearner = await req.nemis.getPendingContinuingLearners();
		req.response.respond([...requestedContinuingLearner, ...approvedContinuingLearner]);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const deleteContinuingLearner = async (req: ExtendedRequest) => {
	try {
		let nemis = req.nemis;
		let queryParams = req.queryParams;
		if (!queryParams.adm || !queryParams.indexNo || !queryParams.birthCertOrUpi)
			throw {
				code: 400,
				message:
					'One of the following is required so as to proceed: leaner adm or' +
					' birthCertificate or indexNo.'
			};
		let learnerToDelete = (await nemis.getPendingContinuingLearners()).filter(
			x =>
				queryParams.birthCertOrUpi.filter(y => y === x.birthCertificateNo).length === 1 ||
				queryParams.adm.filter(y => y === x.adm).length === 1 ||
				queryParams.indexNo.filter(y => y === x.indexNo).length === 1
		);
		learnerToDelete.map(x => x); // todo: create method to delete requested learners
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const captureContinuingLearner = async (req: ExtendedRequest) => {
	try {
		let requestedContinuingLearner: RequestingLearner[],
			approvedContinuingLearner: RequestingLearner[],
			continuingLearnerFromDb: NemisLearnerFromDb[], errors = [];
		(await Promise.allSettled([
			req.nemis.getRequestedContinuingLearners(),
			req.nemis.getPendingContinuingLearners(),
			learner.find({
				$and: [
					{institutionId: req.institution._id},
					{continuing: true},
					{upi: {$exists: false, $eq: undefined}},
					{birthCertificateNo: {$exists: true, $ne: undefined}},
					{indexNo: {$exists: true, $ne: undefined}}]
			}).select('-_id').lean()
		])).map((x, i) => {
			if (x.status === 'rejected')
				return errors.push(x.reason);
			switch (i) {
				case 0:
					requestedContinuingLearner = <RequestingLearner[]>x.value;
					break;
				case 1:
					approvedContinuingLearner = <RequestingLearner[]>x.value;
					break;
				case 2:
					continuingLearnerFromDb = <NemisLearnerFromDb[]><unknown>x.value;
					break;
			}
		});
		if (continuingLearnerFromDb?.length === 0) throw {
			message: 'No continuing learner in the database.'
		};
		let awaitingBiocapture = [], awaitingApproval = [], approvedLearner = [];

		continuingLearnerFromDb.map((x, i) => {
			let approved = approvedContinuingLearner.filter(y => x.adm === y.adm && x.birthCertificateNo === y.birthCertificateNo);
			if (approvedContinuingLearner.length > 0 && approved.length === 1)
				if (approved[0]?.upi) {
					approvedLearner.push({...x, upi: approved[0]?.upi});
					return delete continuingLearnerFromDb[i];
				} else {
					// Approved but no upi
					awaitingBiocapture.push({...x, ...approved[0]});
					return delete continuingLearnerFromDb[i];
				}
			let requested = requestedContinuingLearner.filter(y => x.adm === y.adm && x.birthCertificateNo === y.birthCertificateNo);
			if (requestedContinuingLearner.length > 0 && approved.length === 1) {
				// Awaiting approval
				awaitingApproval.push({...x, ...requested[0]});
				return delete continuingLearnerFromDb[i];
			}
		});
		//Get list of all admitted learners
		let admittedLearner = [], transferLearner = [], apiError = [];
		let requestLearnerWithApi = (await Promise.allSettled(continuingLearnerFromDb.map(x => req.nemis.continuingLearnerApiCalls(x.birthCertificateNo)))).map((x, i) => {
			if (x.status != 'fulfilled') {
				apiError.push({
					...continuingLearnerFromDb[i],
					error: x.reason?.message || 'Api request returned an error'
				});
				return;
			}
			let results = <ContinuingLearnerApiResponse>x.value;
			if (results.isLearner && results?.institutionCode?.toLowerCase() === req.institution.code) {
				admittedLearner.push({
					...continuingLearnerFromDb[i],
					upi: results?.upi,
					institutionName: results?.institutionName,
					institutionCode: results?.institutionCode
				});
				return;
			}
			if (results.isLearner && results?.institutionLevelCode?.toLowerCase() === req.institution?.educationLevel?.toLowerCase()) {
				transferLearner.push({
					...continuingLearnerFromDb[i],
					apiResponse: x,
					upi: results?.upi,
					institutionName: results?.institutionName,
					institutionCode: results?.institutionCode
				});
				return;
			}
			return {
				...continuingLearnerFromDb[i],
				apiResults: results
			};
		}).filter(x => x);
		// request
		let requestPromises = Promise.allSettled(requestLearnerWithApi.map(x => req.nemis.requestContinuingLearners(x)));
		let requestedLearners;
		(await Promise.allSettled([requestPromises]/*,captureBiodataPromises,transferPromises*/)).map((x, i) => {
			switch (i) {
				case 0:
					if (x.status === 'fulfilled')
						requestedLearners = x.value.map((y, i) => {
							return {
								...requestLearnerWithApi[i],
								requested: y.status === 'fulfilled'
							};
						});
			}
		});
		await Promise.allSettled([...requestedLearners].map(x => learner.updateOne({
			$and: [
				{institutionId: req.institution._id},
				{continuing: true},
				{upi: {$exists: false, $eq: undefined}},
				{birthCertificateNo: x.birthCertificateNo},
				{indexNo: x.indexNo}]
		}, x)));
		req.response.respond({
			biodataCaptured: [],
			requested: requestedLearners
		});
		/**
		 * remove those pending approval✅
		 * capture bio data for those approved
		 * request the remaining
		 *  use api to check if they are still in primary school and if so go ahead and capture
		 *  if in secondary school capture transfer request
		 *  if not a learner capture as continuing
		 *  if biodata was successfully captured set continuing to false
		 */

	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
export {
	getContinuingLearner,
	deleteContinuingLearner,
	captureContinuingLearner
};
