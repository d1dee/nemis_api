/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {AxiosError} from 'axios';
import {Promise} from 'mongoose';
import learner from '../../../database/learner';
import {ExtendedRequest, NemisLearnerFromDb} from '../../../interfaces';
import {ListLearner} from '../../../libs/interface';

const captureBiodata = async (req: ExtendedRequest) => {
	try {
		let listLearner = await req.nemis.listLearners('form 1');
		let awaitingBiodataCapture = await req.nemis.getAdmittedJoiningLearners();
		if (awaitingBiodataCapture.length === 0)
			req.response.respond([], 'There is no learner left' + ' to capture biodata.');
		let updateUpi = <(NemisLearnerFromDb & ListLearner)[]>[];
		let learnerToCapture = (
			await learner
				.find({
					$and: [
						{indexNo: {$in: awaitingBiodataCapture.map(x => x.indexNo)}},
						{birthCertificateNo: {$exists: true, $ne: null, $type: 'string'}},
						{institutionId: req.institution?._id}]
				})
				.lean()
		)
			.map(x => {
				if (x.upi) return;
				let listLearnerFilter = listLearner.filter(
					z => z.birthCertificateNo === x.birthCertificateNo
				);
				if (listLearnerFilter.length === 1) {
					updateUpi.push({
						...(x as unknown as NemisLearnerFromDb),
						...listLearnerFilter[0]
					});
					return;
				}
				let awaitingBiodataFilter = awaitingBiodataCapture.filter(
					y => x.indexNo === y.indexNo
				);
				if (awaitingBiodataFilter.length === 1) {
					return {...x as unknown as NemisLearnerFromDb, ...awaitingBiodataFilter[0]};
				}
			})
			.filter(x => x);
		if (learnerToCapture.length === 0) {
			req.response.respond([], 'No learner to capture biodata.');
		}
		if (Object.keys(req.queryParams).includes('await') && req.queryParams?.await === false) {
			req.response.respond(
				learnerToCapture,
				'Below learners\' biodata will be captured in' + ' the background'
			);
		}
		await Promise.allSettled(
			updateUpi.map(x =>
				learner.findByIdAndUpdate(
					x._id,
					{
						upi: x?.upi,
						reported: true,
						error: null
					},
					{new: true}
				)
			)
		);

		let capturedResults = (
			await Promise.allSettled(
				(
					await Promise.allSettled(learnerToCapture.map(x => req.nemis.captureJoiningBiodata(x)))
				).map((x, i) => {
					if (x.status === 'fulfilled')
						return learner.findOneAndUpdate(
							{indexNo: learnerToCapture[i].indexNo},
							{upi: x.value?.upi, reported: true, admitted: true, error: null},
							{new: true}
						);
					return learner.findOneAndUpdate(
						{indexNo: learnerToCapture[i].indexNo},
						{error: x.reason?.message},
						{new: true}
					);
				})
			)
		).map(x => (x.status === 'fulfilled' ? x?.value : x?.reason));

		req.response.respond(
			capturedResults,
			'Processing biodata capture finished with the below' + ' results'
		);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err instanceof AxiosError ? 'axios error' : err
		);
	}
};
const getCapturedBiodata = async (req: ExtendedRequest) => {
	try {
		let listLearner = await req.nemis.listLearners('form 1');
		if (Object.keys(req.queryParams).includes('admitted') && !req.queryParams.admitted) {
			let awaitingBiodataCapture = await req.nemis.getAdmittedJoiningLearners();
			if (awaitingBiodataCapture.length === 0)
				return req.response.respond(
					awaitingBiodataCapture,
					'Admitted' + ' learner list retrieved successfully'
				);
			let notCaptured = awaitingBiodataCapture.filter(
				x => listLearner.filter(y => y.upi === x.upi).length === 0
			);
			if (notCaptured.length > 0) {
				let notCapturedFromDb = await learner
					.find({
						$or: notCaptured.map(x => {
							return {indexNo: x.indexNo};
						})
					})
					.lean();
				if (Array.isArray(notCapturedFromDb) && notCapturedFromDb.length > 0) {
					notCaptured = notCaptured.map(x => {
						let z = notCapturedFromDb.filter(y => x.indexNo === y.indexNo)[0];
						return z ? {...x, ...z} : x;
					});
				}
			}
			return req.response.respond(
				notCaptured,
				'Below are the learners awaiting Biodata' + ' Capture on the Nemis website.'
			);
		}
		return req.response.respond(listLearner, 'Admitted learner list retrieved successfully');
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err
		);
	}
};
export {captureBiodata, getCapturedBiodata};
