/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {ExtendedRequest} from '../../../interfaces';
import {AdmitApiCall, CaptureRequestingLearner} from '../../../libs/interface';

const getSelectedLearners = async (req: ExtendedRequest) => {
	try {
		const nemis = req.nemis;
		let selectedList = await nemis.getSelectedLearners();
		req.response.respond(selectedList, 'Total selected learners: ' + selectedList.length);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const requestAdmission = async (req: ExtendedRequest) => {
	try {
		if (!req.body || !Array.isArray(req.body) || !req.body.every(x => x.indexNo)) {
			throw {
				code: 500,
				message: 'Internal server Error',
				cause: "Wasn't to happend that way"
			};
		}
		let requestingLearners = req.body as CaptureRequestingLearner[];
		const nemis = req.nemis;
		let apiCallResults = (
			await Promise.allSettled(
				requestingLearners.map(x =>
					nemis.admitApiCalls(x.indexNo, {
						code: req.institution?.code,
						knecCode: req.institution?.knecCode
					})
				)
			)
		).map((x, i) => {
			if (x.status === 'rejected')
				return {
					...requestingLearners[i],
					error: x.reason?.message || x.reason
				};
			return {
				...requestingLearners[i],
				...x.value
			};
		});
		let apiErrors = apiCallResults.filter(x => x['error']) as (CaptureRequestingLearner & {
			error: any;
		})[];
		let requestingApiLearner: (CaptureRequestingLearner & AdmitApiCall)[];

		if (apiErrors.length > 0)
			requestingApiLearner = apiCallResults.filter(
				x => !x['error']
			) as (CaptureRequestingLearner & AdmitApiCall)[];
		else requestingApiLearner = apiCallResults as (CaptureRequestingLearner & AdmitApiCall)[];

		if (requestingApiLearner.length === 0) {
			throw {
				code: 400,
				message: 'No valid Learner to request',
				cause: apiErrors
			};
		}
		let requestingApiLearnerResults = (
			await Promise.allSettled(
				requestingApiLearner.map(x =>
					nemis.requestJoiningLearner(x.indexNo, x, {
						code: req.institution.code,
						knecCode: req.institution.knecCode
					})
				)
			)
		).map((x, i) => {
			if (x.status === 'rejected') {
				return {
					...requestingApiLearner[i],
					requested: false,
					error:
						x.reason?.message || x.reason || 'Failed to  request  learner deu to error'
				};
			} else
				return {
					...requestingApiLearner[i],
					requested: true
				};
		});
		req.response.respond(requestingApiLearnerResults);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const getRequestedLearner = async (req: ExtendedRequest) => {
	try {
		if (req.queryParams?.approved) {
			req.response.respond(await req.nemis.getRequestedJoiningLearners());
		} else {
			req.response.respond(await req.nemis.getApprovedJoiningLearners());
		}
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};

export {requestAdmission, getSelectedLearners, getRequestedLearner};
