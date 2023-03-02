/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {MongooseError} from 'mongoose';
import learner from '../../../database/learner';
import {ExtendedRequest, Grades, NemisLearner, NemisLearnerFromDb} from '../../../interfaces';
import {parseLearner} from '../../../libs/converts';
import {AdmitApiCall} from '../../../libs/interface';
import logger from '../../../libs/logger';

const {debug, info, trace} = logger;

// Use this middleware to admit leaner to the NEMIS website
const admitDatabaseJoiningLearners = async (req: ExtendedRequest) => {
	try {
		const queryParams = req.queryParams;
		info('Processing admissions');
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
		//mongoQueryMap.set('admitted', {$ne:true});
		mongoQueryMap.set('institutionId', req.institution._id);
		mongoQueryMap.set('grade', 'form 1');
		trace(mongoQueryMap);
		let databaseResults = <NemisLearnerFromDb[]>(
			await learner.find(Object.fromEntries(mongoQueryMap)).lean()
		);
		debug('Checking if we have learners to admit');
		if (!databaseResults.length)
			return req.response.respond(
				[],
				'All learner have already been admitted or no learner awaiting admission in the database.'
			);
		debug('Calling admitLearner');
		let addLearnerResults = await admitLearner(databaseResults, req);
		await Promise.allSettled(Object.values(addLearnerResults)?.flat()?.map(x => {
			if (x['_id']) return learner.findByIdAndUpdate(x['_id'], x);
			else return learner.findOneAndUpdate({
				$or: [{adm: x['adm']}, {indexNo: x['indexNo']}],
				x
			});
		}));
		return req.response.respond(
			{
				//admittedLearners: addLearnerResults?.admittedLearners,
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
const saveAdmissionResultToDb = async (addLearnerResults) => {
	try {
		// todo:start here
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
					//delete x['apiResponse'];
					return {...x, grade: <Grades>'form 1'};
				})
			);
		}
		if (Array.isArray(requestedLearner) && requestedLearner?.length > 0) {
			learnersToDb.push(
				...requestedLearner.map(x => {
					if (x.apiResponse) learnerToApiDb.push(x.apiResponse);
					//	delete x.apiResponse;
					return {...x, grade: <Grades>'form 1'};
				})
			);
		}
		// use insert many to add learnerToApiDb and admittedLearner
		return learner.insertMany(learnersToDb, {ordered: false}).catch(async e => {
			if (e.code === 11000) {
				let erroredDocuments = e.writeErrors;
				let k = await Promise.allSettled(
					erroredDocuments.map(x => {
						if (x?.err?.code !== 11000) return Promise.reject('Not updated');
						if (!x?.err?.op) return Promise.reject('No op found');
						let id = x?.err?.op._id;
						delete x?.err?.op._id;
						return learner.findByIdAndUpdate(id, x?.err?.op);
					})
				);
				console.log(k);
			}
		});
	} catch (err) {
		if (err instanceof Error || err instanceof MongooseError) logger.error(err);
		throw {message: err.message || 'Error while updating admitted learners in the db'};
	}
};
const admitLearner = async (learners: NemisLearner[], req: ExtendedRequest) => {
	try {
		let errors = <NemisLearner & {error: string; admitted?: boolean; requested?: boolean}[]>[];
		debug('getting already admitted learners');
		let alreadyAdmitted = (await req.nemis.getAdmittedJoiningLearners())
			.map(x => {
				let foundPosition;
				let admittedLearner = learners.filter((y, i) => {
					if (y.indexNo === x.indexNo) {
						foundPosition = i;
						return true;
					}
				});
				if (foundPosition || admittedLearner.length > 1) {
					learners.splice(foundPosition, 1);
					return {...admittedLearner[0], admitted: true};
				}
				return undefined;
			})
			.filter(x => x);
		//trace(alreadyAdmitted);
		debug('getting apiResponse for the remaining learners who aren\'t admitted');
		let learnersAdmitApiResponse = await Promise.allSettled(
			learners.map(x =>
				req.nemis.admitApiCalls(x.indexNo, {
					code: req.institution.code,
					knecCode: req.institution.knecCode
				})
			)
		);
		//trace(learnersAdmitApiResponse);
		debug('filtering learners with api response');
		let learnerWithApiResponse = learnersAdmitApiResponse
			.map((x, i) => {
				if (x.status === 'rejected') {
					errors.push({
						...learners[i],
						error: x.reason?.message,
						admitted: false,
						requested: false
					});
					return;
				}
				// Check if the first letters of gender matches
				if (
					!learners[i]?.gender
						?.toLowerCase()
						?.startsWith(x.value?.gender?.split('')?.shift()?.toLowerCase())
				) {
					errors.push({
						...learners[i],
						error: 'Learner\'s gender doesn\'t match with the api\'s gender',
						admitted: false,
						requested: false
					});
					return;
				}
				//todo: add name check too
				if (learners[i]?.marks !== Number(x?.value?.marks)) {
					errors.push({
						...learners[i],
						error: 'Learner\'s marks doesn\'t match with the api\'s marks',
						admitted: false,
						requested: false
					});
					return;
				}
				return {...learners[i], apiResponse: x.value};
			})
			.filter(x => x);
		//trace(learnerWithApiResponse);
		// Filter learners to request
		debug('filtering learners to request');
		let learnersToRequest = learnerWithApiResponse.filter(
			x => x.apiResponse && x.apiResponse?.schoolAdmitted?.code != req.institution?.knecCode
		);
		trace(learnersToRequest);
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
			debug('Getting already requested learners');
			let alreadyRequested = await req.nemis.getRequestedJoiningLearners();
			let requestedAndApproved = await req.nemis.getApprovedJoiningLearners();
			trace(alreadyRequested);
			debug('requesting remaining learners to request');
			//filter out those who are already requested and those who are approved
			learnersToRequest.map((x, i) => {
				//check if learner is requested and approved
				if (requestedAndApproved.filter(y => y.indexNo === x.indexNo)?.length > 0) {
					requestedLearners.push({...x, requested: true});
					learnersToRequest.splice(i, 1);
					return;
				}
				//check if requested and not yet approved
				if (alreadyRequested.filter(y => y.indexNo === x.indexNo)?.length > 0) {
					requestedLearners.push({
						...x, requested: true, error: 'Learner is already' +
							' requested, awaiting approval from nemis'
					});
					learnersToRequest.splice(i, 1);
					return;
				}
			});
			requestedLearners = (
				await Promise.allSettled(
					learnersToRequest.map(x => {
						let isRequested = alreadyRequested.filter(y => y.indexNo === x.indexNo);
						let isApproved = requestedAndApproved.filter(y => y.indexNo === x.indexNo);
						if (isRequested.length > 0)
							return Promise.reject({
								message: `Learner already requested, awaiting approval on the nemis website.`
							});
						if (isApproved.length > 0)
							return Promise.reject({
								message: `Learner already requested, and approved by ${isRequested[0].approved?.by + ' on' + isRequested[0].approved?.on}`
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
		trace(requestedLearners);
		// Filter learners who failed while requesting
		debug('Filtering learner to admit');
		let learnerToAdmit = learnerWithApiResponse.filter(
			x => x.apiResponse && !requestedLearners.filter(y => y.indexNo === x.indexNo).length
		);
		//trace(learnerToAdmit);
		if (!learnerToAdmit || !learnerToAdmit.length) {
			throw {
				code: 400,
				message: 'We had errors while checking learner details.',
				cause: errors
			};
		}
		let admittedLearners: ({admitted: boolean;} & typeof learnerToAdmit[number])[] = (
			await Promise.allSettled(
				learnerToAdmit.map(x => {
					if (!x.apiResponse) {
						Promise.reject(
							'Learner index failed to return learner\'s' +
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
					admitted: true,
					error: null
				};
			errors.push({
				...learnerToAdmit[i],
				admitted: false,
				error:
					<string>x.reason?.message ||
					'Failed to admit learner with an unknown error.'
			});
		}).filter(x => x);
		return {
			requestedLearners: requestedLearners,
			admittedLearners: [...admittedLearners, ...alreadyAdmitted],
			errors: [...errors]
		};
	} catch (err) {
		throw err;
	}
};
export {admitLearner, getAdmittedLearner, admitJsonLearner, admitDatabaseJoiningLearners};
