/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import Learner from '../../../controller/learner';
import learner from '../../../database/learner';
import {ExtendedRequest, NemisLearner} from '../../../interfaces';
import {parseLearner} from '../../../libs/converts';
import {AdmitApiCall} from '../../../libs/interface';
import logger from '../../../libs/logger';

// Use this middleware to admit leaner to the NEMIS website
const admitDatabseJoiningLearners = async (req: ExtendedRequest) => {
	try {
		const queryParams = req.queryParams;
		logger.info('Processing admissions');
		// If adm is supplied, do not admit any other learners
		let mongoQueryMap = new Map();
		// Set any filtering that the user might submit
		for (const key of Object.keys(queryParams)) {
			switch (key) {
				case 'adm':
				case 'grade':
				case 'stream':
				case 'indexNo':
					mongoQueryMap.set(key, {
						$in: queryParams[key]
					});
					break;
			}
		}
		// Make sure we only get learners who aren't yet admitted
		mongoQueryMap.set('admitted', {$exists: false, $ne: true});
		// Make sure we only get learners linked with our institution
		mongoQueryMap.set('institutionId', req.institution._id);
		// Get learners added to database through /learner [PUT]|[POST]
		let databaseResults = await Learner.prototype.getLearnerFromDatabase(
			Object.fromEntries(mongoQueryMap)
		);
		if (!databaseResults.length) {
			throw {code: 400, message: 'Failed to get learner(s) from database.'};
		}
		let addLearnerResults = await admitLearner(databaseResults, req);
		// return learner and api results to add to database
		let learnersToDb = [] as ({admitted?: boolean; requested?: boolean; error?: string} & Omit<
			typeof addLearnerResults.admittedLearners[number],
			'apiResponse' | 'admitted'
		>)[];
		let learnerToApiDb = [] as AdmitApiCall[];
		let admittedLearner = addLearnerResults?.admittedLearners,
			requestedLearner = addLearnerResults?.requestedLearners;
		if (Array.isArray(admittedLearner) && admittedLearner?.length > 0) {
			learnersToDb.push(
				...admittedLearner.map(x => {
					if (x.apiResponse) learnerToApiDb.push(x.apiResponse);
					delete x.apiResponse;
					return x;
				})
			);
		}
		if (Array.isArray(requestedLearner) && requestedLearner?.length > 0) {
			learnersToDb.push(
				...requestedLearner.map(x => {
					if (x.apiResponse) learnerToApiDb.push(x.apiResponse);
					delete x.apiResponse;
					return x;
				})
			);
		}
		// update learner in db
		await Promise.allSettled(
			learnersToDb.map(x =>
				learner.updateOne({$or: [{adm: x.adm}, {index: x.indexNo}]}, learnersToDb)
			)
		);

		req.response.respond({
			admittedLearners: admittedLearner,
			requestedLearners: requestedLearner
		});
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const getAdmittedLearner = async (req: ExtendedRequest) => {
	try {
		let admitted = await req.nemis.listLearners('form 1');
		/**
		 * If we want admitted learners, just send the list learner array
		 * But when we need those not admitted ie: admitted false, get selected and filter out
		 * those in admitted array
		 */
		if (req.queryParams?.admitted)
			req.response.respond(
				admitted,
				'The following learners have been admitted to ' + req.institution?.name
			);
		// todo: incomplete
		/*if (Object.keys(req.queryParams).includes('admitted') && !req.queryParams?.admitted) {
			(await req.nemis.getSelectedLearners()).filter(x =>
				//admitted.filter(y => y.indexNo === x.indexNo)
			);
		}*/
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err
		);
	}
};

const admitJsonLearner = async (req: ExtendedRequest) => {
	try {
		req.queryParams.grade = 'form 1';
		let addLearnerResults = await admitLearner(
			parseLearner(req.body, req.institution?._id),
			req
		);
		// return learner and api results to add to database
		let learnersToDb = [] as ({admitted?: boolean; requested?: boolean; error?: string} & Omit<
			typeof addLearnerResults.admittedLearners[number],
			'apiResponse' | 'admitted'
		>)[];
		let learnerToApiDb = [] as AdmitApiCall[];
		let admittedLearner = addLearnerResults?.admittedLearners,
			requestedLearner = addLearnerResults?.requestedLearners;
		if (Array.isArray(admittedLearner) && admittedLearner?.length > 0) {
			learnersToDb.push(
				...admittedLearner.map(x => {
					if (x.apiResponse) learnerToApiDb.push(x.apiResponse);
					delete x.apiResponse;
					return x;
				})
			);
		}
		if (Array.isArray(requestedLearner) && requestedLearner?.length > 0) {
			learnersToDb.push(
				...requestedLearner.map(x => {
					if (x.apiResponse) learnerToApiDb.push(x.apiResponse);
					delete x.apiResponse;
					return x;
				})
			);
		}
		// use insert many to add learnerToApiDb and admittedLearner

		await Learner.prototype.addLearnerToDatabase(learnersToDb).catch(e => undefined)
		req.response.respond({
			admittedLearners: admittedLearner,
			requestedLearners: requestedLearner
		});
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err
		);
	}
};
const admitLearner = async (learners: NemisLearner[], req: ExtendedRequest) => {
	try {
		let learnersAdmitApiResponse = await Promise.allSettled(
			learners.map(x =>
				req.nemis.admitApiCalls(x.indexNo, {
					code: req.institution.code,
					knecCode: req.institution.knecCode
				})
			)
		);
		let learnerWithApiResponse = learnersAdmitApiResponse.map((x, i) => {
			if (x.status === 'rejected') return {...learners[i], apiResponse: undefined};
			return {...learners[i], apiResponse: x.value};
		});
		// Filter learners to request
		let learnersToRequest = learnerWithApiResponse.filter(
			x => x.apiResponse && x.apiResponse?.schoolAdmitted?.code != req.institution?.knecCode
		);
		let requestedLearners = [] as ({
			error?: string;
			requested: boolean;
		} & typeof learnerWithApiResponse[number])[];
		if (learnersToRequest.length > 0) {
			/**
			 * Request learner, if successful update learner at learnerWithApiResponse and then
			 * go ahead an admit with other learners. If at all there is an error while
			 * requesting, remove learner from learnerWithApiResponse and add then to failed
			 * requests with reasons why request failed.
			 */
			requestedLearners = (
				await Promise.allSettled(
					learnersToRequest.map(x => {
						return req.nemis.requestJoiningLearner(
							x.indexNo,
							{
								indexNo: x.indexNo,
								parent: {
									tel: x?.father?.tel || x?.mother?.tel || x?.guardian?.tel,
									id: x?.father?.id || x?.mother?.id || x?.guardian?.id
								},
								adm: x.adm,
								requestedBy: req.institution.name,
								...x.apiResponse
							},
							{code: req.institution.code, knecCode: req.institution.knecCode}
						);
					})
				)
			).map((x, i) => {
				if (x.status === 'rejected')
					return {
						...learnersToRequest[i],
						requested: false,
						admitted: false,
						error: x.reason?.message || 'There was an error while requesting learner'
					};
				else {
					return {
						...learnersToRequest[i],
						requested: true,
						admitted: false,
						error:
							'Learner has been request, please wait for nemis approval before' +
							' admitting.'
					};
				}
			});
		}
		// Filter learners who failed while requesting
		let learnerToAdmit = learnerWithApiResponse.filter(
			x => !requestedLearners.filter(y => y.indexNo === x.indexNo).length
		);
		if (!learnerToAdmit || !learnerToAdmit.length) {
			throw {
				code: 400,
				message:
					requestedLearners.filter(x => !x.requested).length > 0
						? 'Some of the learners had errors while requesting.'
						: 'No valid learner to admit, but some of the learners were successfully' +
						' requested',
				cause: requestedLearners.length ? requestedLearners : learnerWithApiResponse
			};
		}
		let admittedLearners: ({
			error?: string;
			admitted: boolean;
		} & typeof learnerToAdmit[number])[] = (
			await Promise.allSettled(
				learnerToAdmit.map(x => {
					if (!x.apiResponse)
						Promise.reject(
							"Learner index failed to return learner's" +
							' admission info. Please check indexNo and retry.'
						);
					return req.nemis.admitJoiningLearner(x);
				})
			)
		).map((x, i) => {
			if (x.status === 'fulfilled')
				return {
					...learnerToAdmit[i],
					admitted: true
				};
			return {
				...learnerToAdmit[i],
				admitted: false,
				error:
					(x.reason?.message as string) ||
					(x.reason?.err?.message as string) ||
					'Failed' + ' to admit' + ' learner' + ' with an unknown error.'
			};
		});
		return {
			requestedLearners: requestedLearners,
			admittedLearners: admittedLearners
		};
	} catch (err) {
		throw err;
	}
};
export {admitLearner, getAdmittedLearner, admitJsonLearner};
