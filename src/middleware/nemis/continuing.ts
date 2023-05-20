/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from 'express';
import learner from '../../database/learner';
import { Grades, ListLearner, SearchLearnerApiResponses } from '../../../types/nemisApiTypes';
import CustomError from '../../libs/error_handler';
import { sendErrorMessage } from '../utils/middlewareErrorHandler';
import { NemisWebService } from '../../libs/nemis/nemis_web_handler';
import { NemisApiService } from '../../libs/nemis/nemis_api_handler';

const captureContinuingLearner = async (req: Request) => {
	try {
		// Get continuing learners to capture
		let continuingLearners = await learner.find({
			continuing: true, // Only admit joining learners,
			institutionId: req.institution._id,
			birthCertificateNo: { $exists: true, $nin: [null, undefined, 0, ''] },
			upi: { $exists: false, $in: [null, undefined, 0, ''] },
			dob: { $exists: true },
			reported: { $ne: true },
			archived: false
		});

		if (continuingLearners.length === 0) {
			throw new CustomError(
				'No valid continuing learners to capture in the database. Please check if all learner have birth certificate numbers before continuing',
				403
			);
		}
		// Get all grades to query list learner
		let listGrades = [...new Set(continuingLearners.map(x => x.grade))];

		// list learners
		let listLearner = await Promise.allSettled(
			listGrades.map(
				grade =>
					new Promise(async (resolve, reject) => {
						try {
							let nemis = new NemisWebService();
							await nemis.login(req.institution.username, req.institution.password); // Use the last cookie
							resolve(nemis.listLearners(grade));
						} catch (err) {
							reject(err);
						}
					})
			)
		);

		let mappedListLearner: { [K in Grades]?: ListLearner[] } = {};

		listLearner.forEach((list, i) => {
			Object.assign(mappedListLearner, {
				[listGrades[i]]:
					list.status === 'fulfilled'
						? list.value
						: list.reason instanceof CustomError
						? list.reason
						: new CustomError(
								list.reason.message ||
									' An error parsing list of captured learners',
								500
						  )
			});
		});

		// Check if any of the continuing learners has a UPI number
		let updateLearner = [] as typeof continuingLearners;
		let learnerToCapture = [] as typeof continuingLearners;

		for (let i = 0; i < continuingLearners.length; i++) {
			let gradeListLearner = mappedListLearner[continuingLearners[i].grade];

			if (!Array.isArray(gradeListLearner)) {
				continue;
			}

			let foundLearnerUpi = gradeListLearner.find(
				x => continuingLearners[i].birthCertificateNo === x.birthCertificateNo
			);

			if (foundLearnerUpi) {
				updateLearner.push(
					Object.assign(continuingLearners[i], {
						upi: foundLearnerUpi.upi,
						reported: true,
						error: null
					})
				);
				continue;
			}
			learnerToCapture.push(continuingLearners[i]);
		}

		// Since we might have transfers in the capturing list, use nemis API to check if to capture or request transfer
		let nemisApi = new NemisApiService();
		let apiResponsePromise = await Promise.allSettled(
			learnerToCapture.map(learner =>
				learner.birthCertificateNo
					? nemisApi.searchLearner(encodeURI(learner.birthCertificateNo))
					: Promise.reject(new CustomError('Learner has no valid birthCertificate'))
			)
		);

		let transferLearner = [];
		let captureLearner = [] as [(typeof learnerToCapture)[number], SearchLearnerApiResponses][];

		apiResponsePromise.forEach((apiResponse, index) => {
			if (apiResponse.status === 'fulfilled') {
				let res = apiResponse.value;
				let learner = learnerToCapture[index];

				switch (true) {
					// Not a learner
					case res.learnerCategory?.code === '0': {
						captureLearner.push([learner, res]);
						break;
					}

					// Current learner
					case res.learnerCategory?.code === '1': {
						let curInst = res.currentInstitution;
						if (!curInst.level || !curInst.code) {
							captureLearner.push([learner, res]);
							break;
						}
						// If learner is admitted in thi school, update
						if (curInst.code === req.institution.code) {
							updateLearner.push(
								Object.assign(learner, {
									upi: res.upi || undefined,
									admitted: true,
									reported: !!res.upi,
									error: undefined,
									nhifNNo: res.nhifNo || undefined
								})
							);
							break;
						}

						// If institution is of lower level than this institution, use capture learner
						// 'ECDE' < 'Primary' < 'Secondary' < 'TTC' < 'TVET' < 'JSS' < 'A-Level' < 'Pre-vocational'
						if (curInst.level < String(req.institution.educationLevel.code)) {
							captureLearner.push([learner, res]);
							break;
						}

						// If both institutions are at the same level
						if (curInst.level === String(req.institution.educationLevel.code)) {
							// Use Regexp to check how many names match
							let regexName = learner.name.match(
								new RegExp(res.name.replaceAll(' ', '|'), 'gi')
							);

							// if api learner's gender is the same as learner, and at least two names are the same; transfer learner
							if (res.gender === learner.gender && regexName && regexName.length > 1)
								transferLearner.push([learner, res]);
							// Else capture error
							else
								Object.assign(learner, {
									error: `learner birth certificate is in use by another learner; ${
										res.name
									}, ${res.gender}, ${res.upi || ''} at ${curInst}`
								});

							break;
						}
						// verify if it is possible to capture higher level learners
						captureLearner.push([learner, res]);
						break;
					}

					// Alumni
					case res.learnerCategory?.code === '2': {
						console.debug([res, learner]);
						break;
					}
				}
			} else {
				Object.assign(learner, {
					error: apiResponse.reason.message
				});
			}
		});

		let cookie = await new NemisWebService().login(
			req.institution.username,
			req.institution.password
		);

		let captureBiodataPromises = await Promise.allSettled(
			captureLearner.map(
				learner => new NemisWebService(cookie).addContinuingLearner(learner[0]) // New class instance to avoid state conflict
			)
		);

		// Return an update for each continuingLearner
		captureBiodataPromises.forEach((res, index) => {
			let learner = captureLearner[index];
			if (res.status === 'fulfilled') {
				Object.assign(learner[0], {
					reported: true,
					upi: res.value?.upi,
					error: undefined
				});
				updateLearner.push(learner[0]);
			} else {
				Object.assign(learner[0], {
					reported: false,
					error: res.reason?.message || 'Error while capturing learner biodata'
				});
				updateLearner.push(learner[0]);
			}
		});

		// update learner without birth certificate number error to reflect it
		await learner.updateMany(
			{
				continuing: true,
				birthCertificateNo: { $in: [null, undefined, ''] },
				error: { $in: [null, undefined, ''] }
			},
			{ error: 'Learner has no birth certificate number.' }
		);

		if (updateLearner.length > 0) await Promise.all(updateLearner.map(x => x.save()));

		// Get errors saved in the database
		let learnerErrors = await learner.find({
			error: { $exist: true, $nin: [null, undefined, '', 0], $type: 'string' }
		});

		req.sendResponse.respond(
			learnerErrors.length < 0 ? learnerErrors : updateLearner,
			`Operation completed successfully ${
				learnerErrors.length > 0 ? 'with below errors' : ''
			}`
		);
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};
export { captureContinuingLearner };
