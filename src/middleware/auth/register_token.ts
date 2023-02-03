/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {registerInstitution} from '../../controller/institution';
import {ExtendedRequest} from '../../interfaces';
import logger from '../../libs/logger';

export default async (req: ExtendedRequest) => {
	const response = req.response;
	try {
		const requestBody = req.body as {username: string; password: string};
		if (!requestBody.username || !requestBody.password) {
			throw {code: 400, message: 'Bad request', cause: 'Username and password are required'};
		}
		if (typeof requestBody.username !== 'string' || typeof requestBody.password !== 'string') {
			throw {code: 400, message: 'Bad request', cause: 'Invalid request body'};
		}
		if (requestBody.username.length < 1 || requestBody.username.length > 20) {
			throw {
				code: 400,
				message: 'Bad request',
				cause: 'Username must be between 1 and 20 characters'
			};
		}
		if (requestBody.password.length < 1 || requestBody.password.length > 20) {
			throw {
				code: 400,
				message: 'Bad request',
				cause: 'Password must be between 1 and 20 characters'
			};
		}

		let registrationObject = await registerInstitution(
			requestBody.username.trim(),
			requestBody.password.trim()
		);

		delete registrationObject.institution.password;
		delete registrationObject.institution.cookie;
		delete registrationObject.institution.__v;
		delete registrationObject.institution._id;
		return response.respond(
			{
				token: registrationObject.token.token,
				expires: registrationObject.token.expires,
				institution: registrationObject.institution
			},
			'',
			201
		);
	} catch (err) {
		logger.error(err);
		if (err?.code === 11000) {
			err = {code: 400, message: 'Bad request, Institution already registered', cause: err};
		}
		if (err?.type === 'invalid_credentials') {
			err = {code: 400, message: 'Bad request, Invalid credentials', cause: err};
		}
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
