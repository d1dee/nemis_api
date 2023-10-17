/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from 'express';
import learner from '@database/learner';
import { Grades, ListLearner, SearchLearnerApiResponses } from 'types/nemisApiTypes';
import CustomError from '@libs/error_handler';
import { sendErrorMessage } from '../utils/middleware_error_handler';
import { NemisWebService } from '@libs/nemis/nemis_web_handler';
import NemisApiService  from '@libs/nemis/nemis_api_handler';
import { uniqueIdentifierSchema } from '@libs/zod_validation';

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
						admitted: true,
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
					: Promise.reject(new CustomError('Learner has no valid birthCertificate', 500))
			)
		);

		let captureLearner = [] as [(typeof learnerToCapture)[number], SearchLearnerApiResponses][];
		let transferLearner = [] as typeof captureLearner;

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
						captureLearner.push([learner, res]);
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

		// If we have learner to transfer, check if leaner wants us to handle transfers at this endpoint.
		// If not, return transfer learners as an error reporting where they are currently captured.
		if (transferLearner.length > 0) {
			if (req.queryParams?.transfer) {
				// Get cookie to use while creating new instances of NemisWebService
				let transfers = await Promise.allSettled(
					transferLearner.map(
						learner =>
							new Promise(async (resolve, reject) => {
								try {
									let nemis = await new NemisWebService();
									await nemis.login(
										req.institution.username,
										req.institution.password
									);
									let transferred = await nemis.transferIn(learner[0]);
									transferred ? resolve(true) : reject(false);
								} catch (err) {
									reject(err);
								}
							})
					)
				);

				transferLearner.forEach((transfer, i) => {
					let transferred = transfers[i].status === 'fulfilled';
					if (transferred) {
						// Leave admitted and reported as undefined to only be set when learner has been released from the current instituion
						Object.assign(transfer[0], {
							transfer: {
								out: false, //True if transferring out false when transferring in
								institution: {
									code: transfer[1].currentInstitution.code,
									name: transfer[1].currentInstitution.name
								}
							},
							upi: transfer[1].upi,
							error: `Transfer request saved. Learner awaits to be release from ${transfer[1].currentInstitution.name}, ${transfer[1].currentInstitution.code}`
						});
					} else {
						Object.assign(transfer[0], {
							error: `Transfer request failed. Learner is admitted at ${transfer[1].currentInstitution.name}, ${transfer[1].currentInstitution.code} with UPI:${transfer[1]?.upi}`
						});
					}
					updateLearner.push(transfer[0]);
				});
			} else {
				transferLearner.forEach(learner => {
					Object.assign(learner[0], {
						admitted: false,
						reported: false,
						upi: undefined,
						error: `Learner is admitted at ${learner[1]?.currentInstitution?.name}, ${learner[1]?.currentInstitution?.code} with UPI:${learner[1]?.upi}. Use the transfer endpoint to transfer learner.`
					});
					updateLearner.push(learner[0]);
				});
			}
		}
		// Return an update for each continuingLearner
		captureBiodataPromises.forEach((res, index) => {
			let learner = captureLearner[index];
			if (res.status === 'fulfilled') {
				Object.assign(learner[0], {
					admitted: true,
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

		// Update learner without birth certificate number error to reflect it
		await learner.updateMany(
			{
				institutionId: req.institution._id,
				continuing: true,
				birthCertificateNo: { $in: [null, undefined, ''] },
				error: { $in: [null, undefined, ''] }
			},
			{ error: 'Learner has no birth certificate number.' }
		);

		if (updateLearner.length > 0) await Promise.all(updateLearner.map(x => x.save()));

		// Get errors saved in the database
		let learnerErrors = await learner.find({
			institutionId: req.institution._id,
			error: { $nin: [null, undefined, '', 0], $type: 'string' }
		});

		req.sendResponse.respond(
			learnerErrors.length > 0 ? learnerErrors : updateLearner,
			`Operation completed successfully ${
				learnerErrors.length > 0 ? 'with below errors' : ''
			}`
		);
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};

const captureSingleContinuingLearner = async (req: Request) => {
	try {
		let uniqueIdentifier = uniqueIdentifierSchema.parse(req.params?.uniqueIdentifier);

		let learnerToCapture = await learner.findOne({
			$or: [
				{ birthCertificateNo: { $eq: uniqueIdentifier } },
				{ adm: { $eq: uniqueIdentifier } }
			],
			institutionId: req.institution._id,
			continuing: true,
			archived: false
		});

		if (!learnerToCapture) {
			throw new CustomError(
				'There are no valid learners to capture. Please add learners to the database before continuing.',
				400,
				'no_valid_learner_to_capture'
			);
		}

		if (learnerToCapture.reported) {
			req.sendResponse.respond(
				learnerToCapture,
				'Learner has already reported to your institution.'
			);
			return;
		}

		if (!learnerToCapture.birthCertificateNo) {
			if (!learnerToCapture.error) {
				learnerToCapture.error = 'Learner has no birth certificate number.';
				await learnerToCapture.save();
			}

			req.sendResponse.respond(
				learnerToCapture,
				'Learner has has no birth certificate number.'
			);
			return;
		}

		let nemisApi = await Promise.allSettled([
			new NemisApiService().searchLearner(encodeURI(learnerToCapture.birthCertificateNo))
		]);

		let searchApiResults: SearchLearnerApiResponses | undefined = undefined;
		let capture = false;

		let apiResponse = nemisApi[0];

		if (apiResponse.status === 'fulfilled') {
			let res = apiResponse.value;

			switch (true) {
				// Not a learner
				case res.learnerCategory?.code === '0': {
					capture = true;
					break;
				}

				// Current learner
				case res.learnerCategory?.code === '1': {
					let curInst = res.currentInstitution;
					if (!curInst.level || !curInst.code) {
						capture = true;
						break;
					}
					// If learner is admitted in thi school, update
					if (curInst.code === req.institution.code) {
						Object.assign(learnerToCapture, {
							upi: res.upi || undefined,
							admitted: true,
							reported: !!res.upi,
							error: undefined,
							nhifNNo: res.nhifNo || undefined
						});
						break;
					}

					// If institution is of lower level than this institution, use capture learner
					// 'ECDE' < 'Primary' < 'Secondary' < 'TTC' < 'TVET' < 'JSS' < 'A-Level' < 'Pre-vocational'
					if (curInst.level < String(req.institution.educationLevel.code)) {
						capture = true;
						break;
					}

					// If both institutions are at the same level
					if (curInst.level === String(req.institution.educationLevel.code)) {
						// Use Regexp to check how many names match
						let regexName = learnerToCapture.name.match(
							new RegExp(res.name.replaceAll(' ', '|'), 'gi')
						);

						// if api learner's gender is not the same as learner, or less than two names match; capture error
						if (res.gender !== learnerToCapture.gender) {
							Object.assign(learnerToCapture, {
								error: `learner birth certificate is in use by another learner; ${
									res.name
								}, ${res.gender}, ${res.upi || ''} at ${curInst}`
							});
							break;
						}
						if (!regexName || regexName?.length < 2) {
							Object.assign(learnerToCapture, {
								error: `Provided learners\' name does not math with those returned by the Nemis API; ${
									res.name
								}, ${res.gender}, ${res.upi || ''} at ${curInst}`
							});
						}

						// Else capture learner
						else searchApiResults = res;
						break;
					}
					// verify if it is possible to capture higher level learners
					capture = true;
					break;
				}

				// Alumni
				case res.learnerCategory?.code === '2': {
					capture = true;
					break;
				}
			}
		} else {
			capture = true;
		}

		let nemis = new NemisWebService();

		// If we can transfer learner, send result  for the user to decide if to transfer
		if (searchApiResults) {
			// If user wants usr to handle transfers at this end point
			if (req.queryParams?.transfer) {
				await nemis.login(req.institution.username, req.institution.password);

				let transferred = await nemis.transferIn(learnerToCapture);
				if (transferred) {
					Object.assign(learnerToCapture, {
						transfer: {
							out: false, //True if transferring out false when transferring in
							institution: {
								code: searchApiResults.currentInstitution.code,
								name: searchApiResults.currentInstitution.name
							}
						},
						upi: searchApiResults.upi,
						error: `Transfer request saved. Learner awaits to be release from ${searchApiResults.currentInstitution.name}, ${searchApiResults.currentInstitution.code}`
					});
				} else {
					Object.assign(learnerToCapture, {
						error: `Transfer request failed. Learner is admitted at ${searchApiResults.currentInstitution.name}, ${searchApiResults.currentInstitution.code} with UPI:${searchApiResults?.upi}`
					});
				}

				await learnerToCapture.save();
				req.sendResponse.respond(
					learnerToCapture,
					learnerToCapture?.upi
						? 'Transfer request saved. Learner awaiting release.'
						: 'Learner transfer failed. See error for details.'
				);

				return;
			} else {
				// Update  db with transfer results
				Object.assign(learnerToCapture, {
					admitted: false,
					reported: false,
					upi: undefined,
					error: `Learner is admitted at ${searchApiResults?.currentInstitution?.name}, ${searchApiResults?.currentInstitution?.code} with UPI:${searchApiResults?.upi}. Use the transfer endpoint to transfer learner.`
				});
				await learnerToCapture.save();

				req.sendResponse.respond(
					learnerToCapture,
					'Learner is currently captured in another institution, use transfer learner endpoint'
				);
				return;
			}
		}

		if (!capture) {
			await learnerToCapture.save();
			req.sendResponse.respond(
				learnerToCapture,
				'Learner failed to capture with error: ' + learnerToCapture.error
			);
			return;
		}

		await nemis.login(req.institution.username, req.institution.password);

		let captureBiodataPromise = await Promise.allSettled([
			nemis.addContinuingLearner(learnerToCapture)
		]);

		// Return an update for each continuingLearner
		let res = captureBiodataPromise[0];

		if (res.status === 'fulfilled') {
			Object.assign(learnerToCapture, {
				admitted: true,
				reported: true,
				upi: res.value?.upi,
				error: undefined
			});
		} else {
			Object.assign(learnerToCapture, {
				reported: false,
				error: res.reason?.message || 'Error while capturing learner biodata'
			});
		}

		// Save changes made to learner
		await learnerToCapture.save();

		req.sendResponse.respond(
			learnerToCapture,
			`Learner capture completed  ${
				learnerToCapture.error ? 'with below errors' : 'successfully'
			}`
		);
	} catch (err) {
		sendErrorMessage(req, err);
	}
};

export { captureContinuingLearner, captureSingleContinuingLearner };
