/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
import {isAxiosError} from 'axios';
import Learner from '../../controller/learner';
import {ExtendedRequest} from '../../interfaces';
import {form, parseLearner} from '../../libs/converts';
import {SearchLearner} from '../../libs/interface';
import {RequestingLearner} from '../interfaces';

const getContinuingLearner = async (req: ExtendedRequest) => {
	const response = req.response;
	try {
		const nemis = req.nemis;
		let getRequestedLearnersPromise = await Promise.allSettled([
			nemis.getRequestedContinuingLearners(),
			nemis.getPendingContinuingLearners()
		]);
		// Error if at least one rejects
		if (!getRequestedLearnersPromise.every(x => x.status === 'fulfilled')) {
			throw {code: 500, message: 'Failed to get list of already requested learners.'};
		}
		response.respond(
			// Set approved
			getRequestedLearnersPromise.flatMap((x, i) => {
				if (i === 0)
					x['value'].forEach(k => {
						k.approved = false;
					});
				if (i === 1)
					x['value'].forEach(k => {
						delete k?.remarks;
						k.approved = true;
					});
				return x['value'];
			})
		);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const addContinuingLearner = async (req: ExtendedRequest) => {
	const response = req.response;
	try {
		const institution = req.institution;
		const requestBody: Partial<RequestingLearner>[] = req.body;
		//clean up body and make sure all fields are present
		if (!Array.isArray(requestBody))
			throw {code: 400, message: 'Request body is not an Array', cause: requestBody};
		let reqContinuingLearnersPromise = [];
		requestBody.forEach(x => {
			if (typeof x != 'object')
				return reqContinuingLearnersPromise.push(Promise.reject(x + ' is not an Object.'));
			// Check keys of x
			let missingKeys = [
				'adm',
				'name',
				'gender',
				'form',
				'grade',
				'birthCertificateNo',
				'kcpeYear',
				'indexNo',
				'remarks'
			].filter(k => {
				if (Object.keys(x).includes(k)) return !x[k];
				return !((k === 'grade' && !!x['form']) || (k === 'form' && !!x['grade']));
			});
			if (missingKeys.length > 0) {
				// Push here to maintain indexes
				return reqContinuingLearnersPromise.push(
					Promise.reject(
						'The following keys were missing | undefined: ' + missingKeys.join(', ')
					)
				);
			} else {
				if (x['grade'] === 'form 1' || x['form'] === 'form 1') {
					if (x['form']) (x.grade = x['form']), delete x['form'];
					return reqContinuingLearnersPromise.push(
						Promise.reject(
							'You can not request form 1 student using this endpoint. Kindly use' +
								' regular form 1 admit method.'
						)
					);
				} else {
					try {
						if (x['form']) (x.grade = x['form']), delete x['form'];
						form(x['grade'])
							? reqContinuingLearnersPromise.push(
									req.nemis.searchLearner(x?.birthCertificateNo)
							  )
							: undefined;
					} catch (e) {
						return reqContinuingLearnersPromise.push(
							Promise.reject(
								(x['grade'] || x['form']) +
									' is not a valid. Expected: form(1-4), grade (1-11) or pp (1-2)'
							)
						);
					}
				}
			}
		});

		let rejectedLearners = (await Promise.allSettled(reqContinuingLearnersPromise))
			.map((x, i) => {
				if (x.status === 'fulfilled') {
					let searchLearnerData: SearchLearner = x?.value;
					if (!searchLearnerData?.isLearner) return;
					if (
						searchLearnerData?.currentInstitution?.level?.toLowerCase() !=
						institution?.educationLevel?.toLowerCase()
					)
						return;
					if (
						searchLearnerData?.currentInstitution?.code?.toLowerCase() ===
						institution?.code?.toLowerCase()
					)
						return {
							...requestBody[i],
							error:
								'Learner is already in your institution with upi ' +
								searchLearnerData?.upi
						};
					else
						return {
							...requestBody[i],
							error:
								'Learner is already admitted at ' +
								searchLearnerData?.currentInstitution?.name +
								'. Fill in a transfer to get learner into your institution.'
						};
				} else {
					if (isAxiosError(x.reason?.error) && x.reason?.error?.response?.status === 500)
						return;
					else if (x.reason?.startsWith('The following keys were missing | undefined:')) {
						let k = requestBody[i];
						requestBody.splice(i, 1);
						return {
							...k,
							error: x.reason || x.reason?.error?.message
						};
					}
					return {
						...requestBody[i],
						error: x.reason || x.reason?.error?.message
					};
				}
			})
			.filter(x => x);
		if (rejectedLearners.length > 0) {
			throw {
				code: 400,
				message: `Errors were encountered while parsing data. Fix below error(s) so as to proceed.`,
				cause: rejectedLearners
			};
		}
		// Add request learners to database and get requestedContinuingLearners. We are ignoring
		// addingLearner results since all that matters is we go through with the request.
		const nemis = req.nemis;
		let requestLearners = requestBody as RequestingLearner[];
		let getRequestedLearnersPromise = await Promise.allSettled([
			nemis.getRequestedContinuingLearners(),
			nemis.getPendingContinuingLearners()
		]);
		// If all are rejected or at least oe has rejected
		if (!getRequestedLearnersPromise.every(x => x.status === 'fulfilled')) {
			throw {message: 'Failed to get list of already requested learners.'};
		}
		let getRequestedLearnersResults: RequestingLearner[] = getRequestedLearnersPromise.flatMap(
			x => x['value']
		);
		// Remove already requested from our request array but remember to send it as requested
		// when responding to request
		let alreadyRequested = requestLearners.filter(
			x =>
				getRequestedLearnersResults.filter(
					y =>
						y.adm === x.adm &&
						y.birthCertificateNo === x.birthCertificateNo &&
						y.indexNo === x.indexNo
				).length === 1
		);
		// Remove already admitted learners from requestLearner array
		if (alreadyRequested.length > 0) {
			requestLearners = requestLearners.filter(
				x => !alreadyRequested.filter(y => y === x).length
			);
		}
		// Now we can go ahead and request
		let requestResults = await Promise.allSettled(
			requestLearners.map(x => nemis.requestContinuingLearners(x))
		);
		let results = [
			...requestResults.filter(x => (x.status === 'fulfilled' ? x.value : false)),
			...alreadyRequested
		];
		let resultError = requestResults.filter(x =>
			x.status === 'rejected'
				? {
						...requestLearners,
						error: x.reason?.message
				  }
				: false
		);
		response.respond(
			[...results, ...resultError],
			resultError.length > 0
				? results.length +
						' learners were successfully requested with ' +
						resultError.length +
						'errors'
				: results.length +
						' learners were successfully requested, awaiting approval by Nemis'
		);
		// out of range
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
		let requestBody = parseLearner(req.body?.validDataObject, req.institution?._id);
		if (!Array.isArray(requestBody) || requestBody.length < 1) {
			throw {
				code: 400,
				message:
					'Invalid of undefined data sent, expected an array of' + ' learner details.'
			};
		}
		const nemis = req.nemis;
		let approvedLearners = await nemis.getPendingContinuingLearners();
		if (!approvedLearners || !Array.isArray(approvedLearners) || approvedLearners.length < 1) {
			return req.response.respond({}, 'No learners has yet been approved.');
		}
		const notCapturedLearners = approvedLearners.filter(x => !x.upi);
		if (notCapturedLearners.length === 0) {
			return req.response.respond(
				approvedLearners,
				'It seems all learners have an UPI number.' + ' No learner left to capture.'
			);
		}
		let capturePromise = notCapturedLearners.map(x => {
			let learnerBiodata = requestBody.filter(
				y =>
					y.birthCertificateNo === x.birthCertificateNo ||
					y.adm === x.adm ||
					y.indexNo === x.indexNo
			);
			if (learnerBiodata.length != 1) {
				return Promise.reject('Missing Learner bio data.');
			}
			return nemis.captureContinuingLearners(learnerBiodata[0], x);
		});

		// todo: save learner to database
		let capturedLearners = (await Promise.allSettled(capturePromise)).map((x, i) => {
			let learnerBiodata = requestBody.filter(
				y =>
					y.birthCertificateNo === notCapturedLearners[i].birthCertificateNo ||
					y.adm === notCapturedLearners[i].adm ||
					y.indexNo === notCapturedLearners[i].indexNo
			)[0];

			if (x.status === 'rejected') {
				return {
					...learnerBiodata,
					error: x.reason?.message,
					admitted: false,
					dob: learnerBiodata.dob?.PlainDate?.toString
				};
			}
			return {
				...learnerBiodata,
				upi: x.value?.upi,
				admitted: true,
				dob: learnerBiodata.dob?.PlainDate?.toString
			};
		});

		await Promise.allSettled([
			Learner.prototype.addLearnerToDatabase(capturedLearners),
			Learner.prototype.addContinuingLearner(notCapturedLearners)
		]);

		let failedCapture = capturedLearners.filter(x => !x?.admitted);
		req.response.respond(
			capturedLearners,
			failedCapture.length > 0
				? failedCapture.length +
						' learner(s) failed to capture. See errors for reasons why.'
				: "All learners' biodata have been captured successfully"
		);
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
	addContinuingLearner,
	deleteContinuingLearner,
	captureContinuingLearner
};
