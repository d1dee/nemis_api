/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import institution_schema from '../database/institution';
import {ExtendedRequest} from '../interfaces';
import logger from '../libs/logger';
import {Nemis} from '../libs/nemis';

export default async (req: ExtendedRequest, res, next) => {
	try {
		if (req.nemis) next();
		if (!req.institution) return next();
		const nemis = new Nemis();
		const {username, password, cookie, _id} = req.institution;
		if (!(await nemis.setCookie(cookie?.value))) {
			// set cookie and check if valid at the same time
			let cookie = await nemis.login(username, password);
			await institution_schema.findByIdAndUpdate(_id, {
				$set: {
					cookie: {
						value: cookie,
						expires: Date.now() + 1000 * 60 * 60
					}
				}
			});
			logger.info('Cookie refreshed');
		}
		req.nemis = nemis;
		logger.info('Nemis set, calling next()');
		next();
	} catch (err) {
		req.response.error(err.code || 500, 'Internal server error', err.message || '');
	}
};
