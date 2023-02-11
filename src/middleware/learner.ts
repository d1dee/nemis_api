/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import Learner from '../controller/learner';
import {ExtendedRequest, NemisLearner, NemisLearnerFromDb} from '../interfaces';
import {parseLearner} from '../libs/converts';
import import_excel from '../libs/import_excel';

const addLearnerByFile = async (req: ExtendedRequest) => {
	try {
		// If for some reason the file path wasn't passed
		if (!Object.hasOwn(req.body, 'file')) {
			throw {code: 400, message: 'No file was uploaded'};
		}
		let validLearner = [] as NemisLearner[],
			invalidLearner = [] as Partial<NemisLearner>[];
		import_excel(req.body.file).map(x => {
			validLearner.push(...x.validDataObject);
			invalidLearner.push(...x.invalidDataObject);
		});
		if (invalidLearner.length > 0) {
			throw {
				code: 400,
				message: 'Following errors were encountered while validating learner',
				cause: invalidLearner
			};
		}
		let insertedDocs = await addCompleteLearner(validLearner, req);
		return req.response.respond(
			insertedDocs,
			insertedDocs?.length + ' learners were successful added to the' + ' database.'
		);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err
		);
	}
};

const addLearnerByJson = async (req: ExtendedRequest) => {
	try {
		let insertedDocs = await addCompleteLearner(req.body, req);
		return req.response.respond(
			insertedDocs,
			insertedDocs?.length + ' learners were successful added to the' + ' database.'
		);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err
		);
	}
};
const addCompleteLearner = async (
	jsonData,
	req: ExtendedRequest
): Promise<NemisLearnerFromDb[]> => {
	try {
		const queryParams = req.queryParams;

		if (jsonData?.length === 0) {
			throw {code: 400, message: 'Parse error', cause: 'Received an empty array.'};
		}
		if (!queryParams.grade)
			throw {
				code: 400,
				message: 'Parse error',
				cause: "You haven' specified learners" + ' grade/form.'
			};

		let insertedDocs: NemisLearnerFromDb[];
		let insertManyErrors: (NemisLearnerFromDb & {error: string})[] = (
			await Promise.allSettled([
				Learner.prototype.addLearnerToDatabase(
					parseLearner(jsonData, req.institution._id, {
						grade: queryParams?.grade
					})
				)
			])
		)
			.map(x => {
				if (x.status === 'fulfilled') {
					insertedDocs = <NemisLearnerFromDb[]>(<unknown>x.value);
					return;
				}
				insertedDocs = x.reason?.insertedDocs;
				return x.reason?.writeErrors?.map(z => {
					return {
						...z?.err?.op,
						error: z.err?.errmsg?.replace(/ collection.*dup/, ', duplicated')
					};
				});
			})
			.flat()
			.filter(x => x);
		if (insertManyErrors.length > 0) {
			throw {
				code: 400,
				message:
					insertedDocs?.length +
					' learner(s) have been successfully saved to database' +
					' with the following errors.',
				cause: insertManyErrors
			};
		}
		if (insertedDocs && insertedDocs.length > 1) return insertedDocs;
		// This would be embarrassing if we reached here
		throw {
			code: 500,
			message: ' No way we should be here, kindly report to the higher ups',
			cause: {
				inserted: insertedDocs,
				errors: insertManyErrors
			}
		};
	} catch (err) {
		throw err;
	}
};

/*

const getLearner = (req: Request, res: Response) => {
	if (Object.keys(req.query).length > 0) {
		//filter learners
		let query = req.query;
		if (Object.keys(query).length === 0) {
			res.status(400).send({
				success: false,
				message: 'Invalid query'
			});
			return;
		}

		let mongoFilter = [];
		let nemisColFilter = [];
		let invalidParams = [];

		[
			'name',
			'adm',
			'form',
			'stream',
			'dob',
			'birthCertNo',
			'county',
			'hasContacts',
			'nhif',
			'upi',
			'admitted'
		].forEach(key => {
			if (query.hasOwnProperty(key)) {
				switch (key) {
					case 'hasContacts':
						if (query.hasContacts === 'true') {
							mongoFilter.push({
								$or: [
									{
										father: {
											$exists: true,
											$ne: {}
										}
									},
									{
										mother: {
											$exists: true,
											$ne: {}
										}
									},
									{
										guardian: {
											$exists: true,
											$ne: {}
										}
									}
								]
							});
						} else {
							mongoFilter.push({
								$and: [
									{
										father: {
											$exists: false
										}
									},
									{
										mother: {
											$exists: false
										}
									},
									{
										guardian: {
											$exists: false
										}
									}
								]
							});
						}
						break;
					case 'stream':
					case 'county':
						if (query[key] === 'true') {
							mongoFilter.push({
								[key]: {
									$exists: true,
									$ne: 0
								}
							});
						} else if (query[key] === 'false') {
							mongoFilter.push({
								[key]: {
									$exists: false
								}
							});
						} else {
							if (
								typeof query[key] === 'string' &&
								query[key].length > 0
							) {
								mongoFilter.push({
									[key]: query[key]
								});
							}
						}
						break;
					case 'form':
					case 'adm':
						if (!isNaN(Number(query[key]))) {
							mongoFilter.push({
								[key]: Number(query[key])
							});
						} else {
							invalidParams.push(key);
						}
						break;
					case 'name':
						if (
							typeof query.name === 'string' &&
							query.name.length > 0
						) {
							let nameArray = query.name.split(' ');
							if (nameArray.length === 1) {
								mongoFilter.push({
									[key]: new RegExp(query.name, 'i')
								});
							} else {
								mongoFilter.push({
									[key]: {
										$all: nameArray.map(
											name => new RegExp(name, 'i')
										)
									}
								});
							}
						} else {
							invalidParams.push(key);
						}
						break;
					case 'dob':
						// todo: add date range filter
						if (
							typeof query.dob === 'string' &&
							query.dob.length > 0
						) {
							if (query.dob.includes('-')) {
								let dateRange = query.dob.split('-');
								if (dateRange.length === 2) {
									let start = new Date(dateRange[0]);
									let end = new Date(dateRange[1]);
									if (
										!isNaN(start.getTime()) &&
										end instanceof Date &&
										!isNaN(end.getTime())
									) {
										mongoFilter.push({
											[key]: {
												$gte: start,
												$lte: end
											}
										});
									} else {
										invalidParams.push(key);
									}
								} else {
									invalidParams.push(key);
								}
							} else {
								let date = new Date(query.dob);
								if (date instanceof Date) {
									mongoFilter.push({
										[key]: {
											date
										}
									});
								} else {
									invalidParams.push(key);
								}
							}
						}
						break;
					case 'admitted':
						if (query[key] === 'true') {
							mongoFilter.push({
								['nemis_id']: {
									$exists: true
								}
							});
						} else if (query[key] === 'false') {
							mongoFilter.push({
								['nemis_id']: {
									$exists: false
								}
							});
						} else {
							mongoFilter.push({
								['nemis_id']: {
									$exists: false
								}
							});
						}
						break;
					//these are in a different collection
					case 'birthCertNo':
					case 'upi':
					case 'nhif':
						if (query[key] === 'true') {
							nemisColFilter.push({
								[key]: true
							});
						} else if (query[key] === 'false') {
							nemisColFilter.push({
								[key]: false
							});
						} else {
							if (
								typeof query[key] === 'string' &&
								query[key].length > 0
							) {
								nemisColFilter.push({
									[key]: query[key]
								});
							}
						}
						break;
					default:
						mongoFilter.push({});
				}
			}
		});

		if (
			Object.keys(mongoFilter).length === 0 &&
			Object.keys(nemisColFilter).length === 0
		) {
			res.status(400).send({
				success: false,
				message: 'Invalid query: ' + invalidParams.join(', ')
			});
			return;
		} else {
			mongoFilter.push({inst: res.locals.inst._id});
			logger.info(mongoFilter, nemisColFilter);
			learner_schema
				.find(
					{$and: mongoFilter},
					{
						_id: 0,
						__v: 0,
						inst: 0
					},
					{
						populate: {
							path: 'nemis_id',
							select: [
								'upi',
								'birthCertNo',
								'dob',
								'gender',
								'isSpecial',
								'medicalCondition',
								'name'
							]
						},
						collation: {
							locale: 'en',
							strength: 2
						},
						lean: true
					}
				)
				.then(docs => {
					if (docs.length > 0) {
						if (nemisColFilter.length > 0) {
							let filteredDocs = docs.filter(doc => {
								let nemisDoc = doc?.nemis_id;
								let match = true;
								nemisColFilter.forEach(filter => {
									try {
										if (
											typeof Object.values(filter)[0] ===
											'boolean'
										) {
											//if true check that upi exists
											if (
												Object.values(filter)[0] ===
												true
											) {
												match =
													typeof nemisDoc[
														Object.keys(filter)[0]
													] === 'string';
											} else if (
												Object.values(filter)[0] ===
												false
											) {
												match =
													!nemisDoc ||
													!nemisDoc[
														Object.keys(filter)[0]
													];
											}
											// : !!!nemisDoc[Object.keys(filter)[0]]*!/
										} else if (
											typeof Object.values(filter)[0] ===
											'string'
										) {
											if (
												typeof nemisDoc[
													Object.keys(filter)[0]
												] === 'string'
											) {
												let value =
													nemisDoc[
														Object.keys(filter)[0]
													];
												let filterValue =
													Object.values(filter)[0];
												if (
													typeof filterValue ===
													'string'
												) {
													match =
														value.toLowerCase() ===
														filterValue?.toLowerCase();
												} else {
													match = false;
												}
											} else {
												match = false;
											}
										}
									} catch (e) {
										if (e instanceof TypeError) {
											match = false;
										}
									}
								});
								return match;
							});
							res.status(200).json({
								success: true,
								count: filteredDocs.length,
								data: filteredDocs
							});
						} else {
							res.status(200).json({
								success: true,
								count: docs.length,
								data: docs
							});
						}
					} else {
						res.status(400).send({
							success: false,
							message: 'No learners found'
						});
					}
					/!*  let response = {
							success: true,
							size: docs.length,
							message: undefined,
							data: docs
						}
						if (invalidParams.length > 0) {
							response.message = 'The following query params were dropped due to invalid values: ' + invalidParams.join(', ')
						}
						res.status(200).send(response)*!/
				})
				.catch(err => {
					logger.error(err);
					res.status(500).send({
						success: false,
						message: 'Internal server error'
					});
				});
		}
	} else {
		//return all learners
		learner_schema
			.find({inst: res.locals.inst._id}, {_id: 0, __v: 0, inst: 0})
			.then(data => {
				res.status(200).send({
					success: true,
					size: data.length,
					data: data
				});
			})
			.catch(err => {
				logger.error(err);
				res.status(500).send({
					success: false,
					message: 'Internal server error'
				});
			});
	}
};
*/

/*const deleteLearner = (req: Request, res: Response) => {

}*/

/*
const updateLearner = (req: Request, res: Response) => {
	// identifying factors : adm, birthCertNo,upi
	let reqBody = req.body;
	if (reqBody.file) {
		let data = import_excel(req.body.file);
		if (data instanceof Error) {
			res.status(400).send({
				success: false,
				message: 'Invalid file'
			});
		} else if (
			Array.isArray(data) &&
			data.length === 1 &&
			data[0].sheetData.length > 1
		) {
			let query = {} as {form: Number; stream: string};
			if (req.query.hasOwnProperty('form')) {
				query.form = <number>(<unknown>req.query.form);
			}
			if (req.query.hasOwnProperty('stream')) {
				query.stream = <string>req.query.stream;
			}
			updateLearnerDb(data[0].sheetData, res.locals.inst._id, query).then(
				data => {
					res.status(data.success ? 200 : 400).send({
						success: data.success,
						message: `${
							data.successfulData.length
						} learners added successfully ${
							data.failedData.length > 0
								? ` and ${data.failedData.length} learners failed to add`
								: ''
						}`,
						failedData: data.failedData,
						successfulData: data.successfulData
					});
				}
			);
		} else {
			res.status(400).send({
				success: false,
				message: 'Invalid file'
			});
		}
	} else {
		if (!reqBody) {
			logger.warn('called patch without request body. failing');
			res.send({
				success: false,
				message:
					'request body should have at least one of the following fields: adm, birthCertNo, upi or form and stream when using a file'
			});
		} else {
			if (Array.isArray(reqBody)) {
				let query = {} as {
					form: Number;
					stream: string;
				};
				if (req.query.hasOwnProperty('form')) {
					query.form = <number>(<unknown>req.query.form);
				}
				if (req.query.hasOwnProperty('stream')) {
					query.stream = <string>req.query.stream;
				}
				updateLearnerDb(reqBody, res.locals.inst._id, query)
					.then(data => {
						res.status(data.success ? 200 : 400).send({
							success: data.success,
							message: `${
								data.successfulData.length
							} learners updated successfully ${
								data.failedData.length > 0
									? ` and ${data.failedData.length} learners failed to add`
									: ''
							}`,
							failedData: data.failedData,
							successfulData: data.successfulData
						});
					})
					.catch(err => {
						logger.error(err);
						res.status(500).send({
							success: false,
							message: 'Internal server error'
						});
					});
			} else {
				res.status(403).send({
					success: false,
					message: 'Expected an array of learners'
				});
			}
		}
	}
};
*/

export {addLearnerByFile, addLearnerByJson, addCompleteLearner};
