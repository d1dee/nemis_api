/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {
	archiveInstitution,
	updateInstitution as updateInstitutionController
} from '../controller/institution';
import {DbInstitution, ExtendedRequest} from '../interfaces';
import logger from '../libs/logger';
import {Nemis} from '../libs/nemis';

const getInstitution = (req: ExtendedRequest) => {
	const response = req.response;
	try {
		let institution = req.institution;
		let token = req.token;

		if (!token || !institution) {
			throw {
				code: 500,
				message: 'Something went terribly wrong. Please contact the administrator'
			};
		}

		institution = Object.assign(institution, {
			token: token.token,
			tokenCreatedAt: token.createdAt,
			tokenExpiresAt: token.expires
		});

		//delete institution.password;
		//delete institution._id;
		//delete institution.__v;
		//delete institution.cookie;

		return response.respond({
			token: token.token,
			expires: token.expires,
			created: token.createdAt,
			...institution
		});
	} catch (err) {
		//Handle errors here and return a response
		logger.error(err);
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};

const updateInstitution = async (req: ExtendedRequest) => {
	try {
		const body = req.body;
		const institution = req.institution as DbInstitution;
		if (!Object.hasOwn(body, 'username') || !Object.hasOwn(body, 'password')) {
			logger.error('Username or password not provided');
			throw {
				code: 400,
				message: 'Username or password not provided',
				cause: `request.body: ${JSON.stringify(body)}`
			};
		}
		if (!body.username || !body.password || body.username === '' || body.password === '') {
			logger.error('Username or password is empty');
			throw {
				code: 400,
				message: 'Username or password is empty',
				cause: `request.body: ${JSON.stringify(body)}`
			};
		} else if (
			body.username === institution.username &&
			body.password === institution.password
		) {
			logger.error('Username and password are the same');
			throw {
				code: 400,
				message: 'Username and password are the same',
				cause: `request.body: ${JSON.stringify(body)}`
			};
		}
		const nemis = new Nemis();
		let cookie = await nemis.login(body.username, body.password);
		if (!cookie || typeof cookie !== 'string') {
			logger.error(`The provided credentials for the user ${body.username} are invalid`);
			if (!cookie) {
				throw {
					code: 401,
					message: 'Invalid username or password',
					cause:
						'You sent an incorrect ' +
						'username or password, please check before resending'
				};
			}
		}
		let token = req.token;
		if (!token || !Object.hasOwn(token, 'institutionId')) {
			throw {
				code: 400,
				message: 'Unable to update institution',
				cause: 'Token was has no associated institution. '
			};
		}
		let updatedInstitution = await updateInstitutionController(
			body.username,
			body.password,
			token.institutionId
		);
		if (!updatedInstitution) {
			throw {
				code: 400,
				message: 'Unable to update institution',
				cause: 'Institution not found. '
			};
		} else {
			return req.response.respond({
				success: true,
				message: 'Institution updated',
				data: updatedInstitution
			});
		}
	} catch (err) {
		if (err.type === 'invalid_credentials') {
			req.response.error(401, 'Invalid username or password', err);
		}
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};

const deleteInstitution = async (req: ExtendedRequest) => {
	const response = req.response;
	try {
		let token = req.token;
		if (!token || !Object.hasOwn(token, '_id') || !Object.hasOwn(token, 'institutionId')) {
			throw {
				code: 400,
				message: 'Unable to delete institution',
				cause: 'Token was has no associated institution. '
			};
		}

		let isArchive = await archiveInstitution(token.institutionId, String(token._id));
		if (!isArchive) {
			throw {
				code: 400,
				message: 'Unable to delete institution',
				cause: 'Institution not found'
			};
		} else {
			const institution = req.institution;
			delete institution.password;
			delete institution._id;
			delete institution.__v;
			delete institution.token;
			delete institution.cookie;

			return response.respond({
				success: true,
				message: 'Institution deleted',
				data: {
					token: token.token,
					tokenCreatedAt: token.createdAt,
					tokenExpiresAt: token.expires,
					...institution,
					archived: true
				}
			});
		}
	} catch (err) {
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};

export {deleteInstitution, getInstitution, updateInstitution};
