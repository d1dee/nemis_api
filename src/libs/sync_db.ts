/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

// Change of plans, all we need is away to identify our learner. It shouldn't matter how many
// calls we make to nemis
// We should use out db to match with nemis instead of using nemis data to match our own

import {NextFunction} from 'express';
import {Promise} from 'mongoose';
import Learner from '../controller/learner';
import nemis_api_results from '../database/nemis_api_results';
import {ExtendedRequest} from '../interfaces';
import set_cookie from '../middleware/set_cookie';
import logger from './logger';

export default async (req: ExtendedRequest, _, next: NextFunction) => {
	try {
		if (!req.institution) return next();
		if (!req.nemis) await set_cookie(req, _, next);
		let nemis = req.nemis;
		let institution = req.institution;
		// Check how many learners do not have upi linked to them
		let learnerWithoutUPi = await Learner.prototype.getLearnerFromDatabase({
			birthCertificateNo: {$exists: true},
			institutionId: institution._id.toString(),
			upi: {$exists: false}
		});
		if (learnerWithoutUPi.length === 0) {
			return;
		}
		// We are not rate limited, so we can just get all at once
		let searchLearnersPromises = learnerWithoutUPi.map(x =>
			nemis.searchLearner(x.birthCertificateNo)
		);
		let insertManyQuery = [];
		let updateLeanerInDbPromise = (await Promise.allSettled(searchLearnersPromises)).filter(
			(x, i) => {
				if (x.status === 'rejected') return;
				// todo: If rejected push  to rejected array and use name match with
				//  listLearners, then check list learners resulting bCert with the current
				//  bCert to get the differences
				if (!x.value?.upi) return;
				insertManyQuery.push({
					institutionId: institution?._id?.toString(),
					learnerId: learnerWithoutUPi[i]?._id?.toString(),
					...x.value
				});
				return Learner.prototype.updateLearnerInDatabase(
					{_id: learnerWithoutUPi[i]?._id?.toString()},
					{upi: x.value?.upi, admitted: true}
				);
			}
		);
		await Promise.allSettled(updateLeanerInDbPromise);
		await nemis_api_results.insertMany(insertManyQuery, {ordered: false, rawResult: false});
		logger.debug('new upi added to database');
		logger.trace(insertManyQuery);
		//console.log(searchLearnersResult);
	} catch (err) {
		logger.error(err);
	}
};
