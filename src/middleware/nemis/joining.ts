/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { sendErrorMessage } from '../utils/middlewareErrorHandler';
import { Request } from 'express';
import learner from '../../database/learner';
import { NemisWebService } from '../../libs/nemis/nemis_web_handler';
import CustomError from '../../libs/error_handler';
import { CaptureBiodataResponse, ListAdmittedLearner } from '../../../types/nemisApiTypes';

const captureJoiningLearner = async (req: Request) => {
	try {
		// Get learner who aren't captured from the database
		const learnerNotCaptured = await learner
			.find({
				continuing: false, // Only admit joining learners,
				institutionId: req.institution._id,
				indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
				admitted: true,
				upi: { $exists: false, $in: [null, undefined, 0, ''] },
				birthCertificateNo: { $exists: true, $nin: [null, undefined, 0, ''] },
				dob: { $exists: true },
				archived: false
			})
			.sort({ birthCertificateNo: 1 });

		// Get list of captured learners frm Nemis website
		const nemis = new NemisWebService();
		let cookie = await nemis.login(req.institution.username, req.institution.password);

		let listCapturedLearners = await nemis.listLearners('form 1');

		// Sort to reduce search time
		if (listCapturedLearners.length > 10) {
			listCapturedLearners.sort((a, b) =>
				a.birthCertificateNo.localeCompare(b.birthCertificateNo)
			);
		}

		// Filter out learner who aren't captured on Nemis
		let learnerToCapture: typeof learnerNotCaptured = [];
		for (const learner of learnerNotCaptured) {
			let listLearner = listCapturedLearners.filter(
				x => x.birthCertificateNo === learner.birthCertificateNo
			);
			if (listLearner.length === 1) {
				learner.upi = listLearner[0].upi;
				learner.reported = true;
				learner.error = undefined;
			} else if (listLearner.length > 1) {
				learner.error = `WARNING: Learner has been has been captured ${listLearner.length} times.`;
				learnerToCapture.push(learner);
			} else {
				learnerToCapture.push(learner);
			}
		}

		// Update database to match with Nemis
		await Promise.all(learnerNotCaptured.map(x => (x.reported ? x.save() : Promise.resolve())));

		// Get list of admitted learner to get learner Postback values
		let learnerWithPostback = [] as unknown as [
			[(typeof learnerNotCaptured)[number], ListAdmittedLearner | CustomError]
		];

		if (learnerToCapture.length > 0) {
			// Match learnerToCapture with their respective postback
			let admittedLearner = await nemis.listAdmittedJoiningLearners();

			for (let i = 0; i < learnerToCapture.length; i++) {
				let admitted = admittedLearner.filter(
					x => x.indexNo === learnerToCapture[i].indexNo
				);
				if (admitted.length === 1) {
					learnerWithPostback.push([learnerToCapture[i], admitted[0]]);
				} else {
					learnerWithPostback.push([
						learnerToCapture[i],
						new CustomError('Learner is not admitted yet', 400)
					]);
				}
			}
		}

		// Capture biodata for the filtered learners
		let captureResults = await Promise.allSettled(
			learnerWithPostback.map(learner => {
				return new Promise((resolve, reject) => {
					if (learner[1] instanceof CustomError) {
						reject([learner]);
					} else {
						new NemisWebService(cookie, nemis.getState())
							.captureJoiningBiodata(learner[0], learner[1])
							.then(captureResults => {
								resolve([learner[0], captureResults]);
							})
							.catch(err => {
								reject([learner[0], err]);
							});
					}
				});
			})
		);

		// Update database with any errors and upi's captured
		let results = await Promise.all(
			captureResults.map(x => {
				if (x.status === 'fulfilled') {
					let value = x.value as [
						(typeof learnerNotCaptured)[number],
						CaptureBiodataResponse
					];

					value[0].upi = value[1].upi;
					value[0].error = undefined;
					value[0].reported = true;

					return value[0].save();
				} else {
					let value = x.reason as [(typeof learnerNotCaptured)[number], CustomError];

					value[0].error = value[1].message;

					return value[0].save();
				}
			})
		);

		// Check if we have learner without birth certificate and report to user before returning
		let learnerWithoutBCert = await learner.find({
			continuing: false, // Only admit joining learners,
			institutionId: req.institution._id,
			indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
			admitted: true,
			upi: { $exists: false, $in: [null, undefined, 0, ''] },
			birthCertificateNo: { $exists: false, $in: [null, undefined, 0, ''] },
			archived: false
		});

		if (learnerWithoutBCert.length > 0) {
			return req.sendResponse.respond(
				learnerWithoutBCert.map(x => ({
					...x.toJSON,
					error: 'Learner has no birth certificate assigned'
				})),
				'All learners have already been captured'
			);
		}
		return req.sendResponse.respond(
			[...results, ...learnerWithoutBCert],
			'All learners have already been captured'
		);
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};

export { captureJoiningLearner };
