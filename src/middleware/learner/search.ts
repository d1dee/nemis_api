/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {ExtendedRequest} from '../../interfaces';

export default async (req: ExtendedRequest) => {
	const response = req.response;
	try {
		const nemis = req.nemis;
		let birthCertOrUpi = req.queryParams?.birthCertOrUpi;
		if (!birthCertOrUpi?.length) {
			throw {code: 400, message: "Learner's upi or birthCertificateNo was not supplied"};
		}
		let searchResult = await Promise.allSettled(
			birthCertOrUpi.map(x => nemis.searchLearner(x))
		);
		return response.respond(
			searchResult
				.filter(x => x.status === 'fulfilled')
				.map(x => (x.status !== 'rejected' ? x?.value : {})),
			'Total selected' + ' learners: ' + searchResult.length
		);
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
