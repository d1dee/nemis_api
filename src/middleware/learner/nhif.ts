/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {ExtendedRequest} from '../../interfaces';

const submitNhif = async (req: ExtendedRequest) => {
	const response = req.response;
	try {
		const queryParams = req.queryParams;
		if (!queryParams.grade)
			throw {
				code: 400,
				message: 'Please specify grade/ form of the learners you wish to submit to nhif',
				cause: 'You did not specify the grade or form you wish to submit.'
			};
		const nemis = req.nemis;
		if (req.queryParams['await']) {
			return response.respond(
				await nemis.submitToNhif(queryParams.grade),
				'Below learners have been successfully submitted to NHIF'
			);
		}
		let learnersWithoutNhif = (await nemis.listLearners(queryParams.grade)).filter(
			learner => !learner.nhifNo
		);
		response.respond(
			learnersWithoutNhif,
			'Below learners will be submitted to NHIF in the background.'
		);
		await nemis.submitToNhif(queryParams.grade);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
const getNhif = async (req: ExtendedRequest) => {
	const response = req.response;
	try {
		const queryParams = req.queryParams;
		if (!queryParams.grade)
			throw {
				code: 400,
				message: 'Please specify grade/ form of the learners you wish to submit to nhif',
				cause: 'You did not specify the grade or form you wish to submit.'
			};

		const nemis = req.nemis;
		let results = await nemis.listLearners(queryParams.grade);
		let returnResults;
		Object.keys(queryParams).forEach(x => {
			switch (x) {
				case 'nhif':
					returnResults = results.filter(x => {
						if (queryParams.nhif) return x.nhifNo;
						return !x.nhifNo;
					});
					break;
				case 'upi':
				case 'birthCertificateNo':
					returnResults = results.filter(
						x =>
							queryParams.birthCertOrUpi.filter(
								j => j?.toLowerCase() == x.upi?.toLowerCase()
							).length === 1
					);
			}
		});
		response.respond(returnResults);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
export {submitNhif, getNhif};
