/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {MongooseError} from 'mongoose';
import learner from '../../../database/learner';
import {ExtendedRequest, Grades, NemisLearner, NemisLearnerFromDb} from '../../../interfaces';
import {parseLearner} from '../../../libs/converts';
import {AdmitApiCall} from '../../../libs/interface';
import logger from '../../../libs/logger';

// Use this middleware to admit leaner to the NEMIS website
const admitDatabaseJoiningLearners = async (req: ExtendedRequest) => {
	try {
		const queryParams = req.queryParams;
		logger.info('Processing admissions');
		// If adm is supplied, do not admit any other learners
		let mongoQueryMap = new Map();
		// Set any filtering that the user might submit
		for (const key of Object.keys(queryParams)) {
			switch (key) {
				case 'adm':
				case 'stream':
				case 'indexNo':
					mongoQueryMap.set(key, {
						$in: queryParams[key]
					});
					break;
			}
		}
		mongoQueryMap.set('admitted', {$ne: true});
		mongoQueryMap.set('institutionId', req.institution._id);
		mongoQueryMap.set('grade', 'form 1');
		let databaseResults = <NemisLearnerFromDb[]>(
			await learner.find(Object.fromEntries(mongoQueryMap)).lean()
		);
		if (!databaseResults.length)
			return req.response.respond(
				[],
				'All learner have already' +
					' been admitted or no learner awaiting admission in the database.'
			);
		let addLearnerResults = await admitLearner(databaseResults, req);
		await saveAdmissionResultToDb(addLearnerResults);
		req.response.respond(
			{
				admittedLearners: addLearnerResults?.admittedLearners,
				requestedLearners: addLearnerResults?.requestedLearners,
				errors: addLearnerResults?.errors
			},
			Array.isArray(addLearnerResults?.errors) && addLearnerResults?.errors.length > 0
				? 'Operation completed with some errors'
				: 'operation completed successfully'
		);
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
		await saveAdmissionResultToDb(addLearnerResults);
		req.response.respond(
			{
				admittedLearners: addLearnerResults?.admittedLearners,
				requestedLearners: addLearnerResults?.requestedLearners,
				errors: addLearnerResults?.errors
			},
			Array.isArray(addLearnerResults?.errors) && addLearnerResults?.errors.length > 0
				? 'Operation completed with some errors'
				: 'operation completed successfully'
		);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err
		);
	}
};
const saveAdmissionResultToDb = async addLearnerResults => {
	try {
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
					if (x['apiResponse']) learnerToApiDb.push(x['apiResponse']);
					delete x['apiResponse'];
					return {...x, grade: <Grades>'form 1'};
				})
			);
		}
		if (Array.isArray(requestedLearner) && requestedLearner?.length > 0) {
			learnersToDb.push(
				...requestedLearner.map(x => {
					if (x.apiResponse) learnerToApiDb.push(x.apiResponse);
					delete x.apiResponse;
					return {...x, grade: <Grades>'form 1'};
				})
			);
		}
		// use insert many to add learnerToApiDb and admittedLearner
		await learner.insertMany(learnersToDb, {ordered: false}).catch(async e => {
			if (e.code === 11000) {
				let erroredDocuments = e.writeErrors;
				await Promise.allSettled(
					erroredDocuments.map(x => {
						if (x?.code !== 11000) Promise.reject('Not updated');
						if (!x?.err?.op) Promise.reject('No op found');
						delete x?.err?.op._id;
						return learner.updateOne(
							{$or: [{adm: x?.err?.op?.adm}, {indexNo: x?.err?.op?.indexNo}]},
							x?.err?.op
						);
					})
				);
			}
		});
	} catch (err) {
		if (err instanceof Error || err instanceof MongooseError) logger.error(err);
		throw {message: err.message || 'Error while updating admitted learners in the db'};
	}
	throw {message: 'Error while updating admitted learners in db'};
};
const admitLearner = async (learners: NemisLearner[], req: ExtendedRequest) => {
	try {
		let errors = <NemisLearner & {error: string; admitted: boolean; requested: boolean}[]>[];

		let alreadyAdmitted = (await req.nemis.getAdmittedJoiningLearners())
			.map(x => {
				let foundPosition;
				let admittedLearner = learners.filter((y, i) => {
					if (y.indexNo === x.indexNo) {
						foundPosition = i;
						return true;
					}
				});
				if (foundPosition) {
					learners.splice(foundPosition, 1);
					return {...admittedLearner[0], admitted: true};
				}
				return undefined;
			})
			.filter(x => x);
		let learnersAdmitApiResponse = await Promise.allSettled(
			learners.map(x =>
				req.nemis.admitApiCalls(x.indexNo, {
					code: req.institution.code,
					knecCode: req.institution.knecCode
				})
			)
		);
		let learnerWithApiResponse = learnersAdmitApiResponse
			.map((x, i) => {
				if (x.status === 'rejected') {
					errors.push({
						...learners[i],
						error: x.reason?.message?.error?.message || x.reason?.message,
						admitted: false,
						requested: false
					});
					return;
				}
				if (
					learners[i]?.gender
						?.toLowerCase()
						?.startsWith(x.value?.gender?.split('')?.shift()?.toLowerCase())
				) {
					errors.push({
						...learners[i],
						error: "Learner' gender doesn't match with the api's gender",
						admitted: false,
						requested: false
					});
					return;
				}
				return {...learners[i], apiResponse: x.value};
			})
			.filter(x => x);
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
			let alreadyRequested = await req.nemis.getRequestedJoiningLearners();
			requestedLearners = (
				await Promise.allSettled(
					learnersToRequest.map(x => {
						if (alreadyRequested.filter(y => y.indexNo === x.indexNo).length > 0)
							Promise.reject({
								message: 'Learner already requested, awaiting approval.'
							});
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
			)
				.map((x, i) => {
					if (x.status === 'rejected') {
						errors.push({
							...learnersToRequest[i],
							requested: false,
							admitted: false,
							error:
								x.reason?.message || 'There was an error while requesting learner'
						});
						return;
					} else {
						return {
							...learnersToRequest[i],
							requested: true,
							admitted: false,
							error:
								'Learner has been request, please wait for nemis approval before' +
								' admitting.'
						};
					}
				})
				.filter(x => x);
		}
		// Filter learners who failed while requesting
		let learnerToAdmit = learnerWithApiResponse.filter(
			x => x.apiResponse && !requestedLearners.filter(y => y.indexNo === x.indexNo).length
		);
		if (!learnerToAdmit || !learnerToAdmit.length) {
			throw {
				code: 400,
				message: 'We had errors while checking learner details.',
				cause: errors
			};
		}
		let admittedLearners: ({
			error?: string;
			admitted: boolean;
		} & typeof learnerToAdmit[number])[] = (
			await Promise.allSettled(
				learnerToAdmit.map(x => {
					if (!x.apiResponse) {
						Promise.reject(
							"Learner index failed to return learner's" +
								' admission info. Please check indexNo and retry.'
						);
						return;
					}
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
					<string>x.reason?.message ||
					<string>x.reason?.err?.message ||
					'Failed' + ' to admit' + ' learner' + ' with an unknown error.'
			};
		});
		return {
			requestedLearners: requestedLearners,
			admittedLearners: [...admittedLearners, ...alreadyAdmitted],
			errors: errors
		};
	} catch (err) {
		throw err;
	}
};
export {admitLearner, getAdmittedLearner, admitJsonLearner, admitDatabaseJoiningLearners};
