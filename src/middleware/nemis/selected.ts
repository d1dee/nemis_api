/*
/!*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 *!/

import { Request } from 'express';
import { AdmitApiCall, RequestingJoiningLearner } from '../../../types/nemisApiTypes';
import { requestingJoiningLearnerSchema } from '../../libs/zod_validation';
import { NemisApiService } from '../../libs/nemis/nemis_api_handler';

const getSelectedLearners = async (req: Request) => {
	try {
		const nemis = req.nemis;
		let selectedList = await nemis.getSelectedLearners();
		req.sendResponse.respond(selectedList, 'Total selected learners: ' + selectedList.length);
	} catch (err: any) {
		req.sendResponse.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const requestAdmission = async (req: Request) => {
	try {
		if (!req.body || !Array.isArray(req.body) || !req.body.every(x => x.indexNo)) {
			throw {
				code: 500,
				message: 'Internal server Error',
				cause: "Wasn't to happen that way"
			};
		}

		let validRequestingLearner: Array<RequestingJoiningLearner> = [],
			invalidRequestingLearner: any[] = [];
		if (Array.isArray(req.body)) {
			// Check if we received an array or an object
			req.body.forEach(x => {
				let parsedX = requestingJoiningLearnerSchema.safeParse(x);
				if (parsedX.success) {
					validRequestingLearner.push(parsedX.data);
				} else {
					invalidRequestingLearner.push({ ...x, validationError: parsedX.error.issues });
				}
			});

			if (invalidRequestingLearner.length > 0) {
				throw {
					message: 'Validation failed.',
					code: 403,
					cause: invalidRequestingLearner
				};
			}
		} else if (
			typeof req.body === 'object' &&
			Object.prototype.toString.call(req.body) === '[object Object]'
			// Make sure it is a plain object
		) {
			let parsedX = requestingJoiningLearnerSchema.safeParse(req.body);
			if (parsedX.success) {
				validRequestingLearner.push(parsedX.data);
			} else {
				invalidRequestingLearner.push({
					//@ts-ignore we already know it is an object
					...req.body,
					validationError: parsedX.error.issues
				});
			}
		}

		const nemis = req.nemis;

		let apiCallResults = (
			await Promise.allSettled(
				validRequestingLearner.map(x => new NemisApiService().admitApiCalls(x.indexNo))
			)
		).map((x, i) => {
			if (x.status === 'rejected')
				return {
					...validRequestingLearner[i],
					error: x.reason?.message || x.reason
				};
			return {
				...validRequestingLearner[i],
				...x.value,
				error: undefined
			};
		});

		let apiErrors = apiCallResults.filter(x => x['error']) as (RequestingJoiningLearner & {
			error: any;
		})[];
		let requestingApiLearner: (RequestingJoiningLearner & AdmitApiCall)[];

		if (apiErrors.length > 0)
			// @ts-ignore
			requestingApiLearner = apiCallResults.filter(
				x => !x?.error
			) as (RequestingJoiningLearner & AdmitApiCall)[];
		// @ts-ignore
		else requestingApiLearner = apiCallResults as (RequestingJoiningLearner & AdmitApiCall)[];

		if (requestingApiLearner.length === 0) {
			throw {
				code: 400,
				message: 'No valid Learner to request',
				cause: apiErrors
			};
		}
		let requestingApiLearnerResults = (
			await Promise.allSettled(
				requestingApiLearner.map(x => nemis.requestJoiningLearner(x.indexNo, x))
			)
		).map((x, i) => {
			if (x.status === 'rejected') {
				return {
					...requestingApiLearner[i],
					requested: false,
					error:
						x.reason?.message ||
						x.reason ||
						'Failed to  request  learner_router deu to error'
				};
			} else
				return {
					...requestingApiLearner[i],
					requested: true
				};
		});
		req.sendResponse.respond(requestingApiLearnerResults);
	} catch (err: any) {
		req.sendResponse.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const getRequestedLearner = async (req: Request) => {
	try {
		if (req.queryParams?.approved) {
			req.sendResponse.respond(await req.nemis.getApprovedJoiningLearners());
		} else {
			req.sendResponse.respond(await req.nemis.getRequestedJoiningLearners());
		}
	} catch (err: any) {
		req.sendResponse.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};

export { requestAdmission, getSelectedLearners, getRequestedLearner };
*/
