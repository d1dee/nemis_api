/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from 'express';
import { archiveInstitution, updateInstitution as updateInstitutionController } from '../../controller/institution';
import logger from '../../libs/logger';
import CustomError from '../../libs/error_handler';
import { usernamePasswordSchema } from '../../libs/zod_validation';
import { sendErrorMessage } from '../utils/middlewareErrorHandler';
import { NemisWebService } from '../../libs/nemis/nemis_web_handler';

const getInstitution = (req: Request) => {
	const response = req.sendResponse;
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
			...institution,
			token: token.token,
			expires: token.expires,
			created: token.createdAt
		});
	} catch (err: any) {
		//Handle errors here and return a response
		logger.error(err);
		sendErrorMessage(req, err);
	}
};

const updateInstitution = async (req: Request) => {
	try {
		const body = await usernamePasswordSchema.parseAsync(req.body);

		if (body.username !== req.institution.username)
			throw new CustomError(
				'Unable to update username. Please create a new account instead.',
				405,
				'method_not_allowed'
			);
		if (body.password === req.institution.password) {
			logger.error('Password are the same');
			throw new CustomError(
				'Invalid request. Username and password are the same as the previous password.',
				400,
				'bad_request'
			);
		}
		const nemis = new NemisWebService();
		let cookie = await nemis.login(body.username, body.password);

		if (!cookie) {
			throw new CustomError('Invalid username or password', 401, 'invalid_credentials');
		}
		let token = req.token;
		if (!token || !Object.hasOwn(token, 'institutionId')) {
			throw new CustomError('Unable to update institution', 400);
		}
		let updatedInstitution = await updateInstitutionController(
			body.username,
			body.password,
			token.institutionId.toString()
		);
		if (!updatedInstitution) {
			throw new CustomError('Unable to update institution', 400);
		} else {
			return req.sendResponse.respond({
				success: true,
				message: 'Institution updated',
				data: updatedInstitution
			});
		}
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};

const deleteInstitution = async (req: Request) => {
	try {
		let token = req.token;
		if (!token || !Object.hasOwn(token, '_id') || !Object.hasOwn(token, 'institutionId')) {
			throw {
				code: 400,
				message: 'Unable to delete institution',
				cause: 'Token was has no associated institution. '
			};
		}

		let isArchive = await archiveInstitution(token.institutionId, token._id);
		if (!isArchive) {
			throw {
				code: 400,
				message: 'Unable to delete institution',
				cause: 'Institution not found'
			};
		} else {
			const institution = req.institution;

			req.sendResponse.respond(
				{
					...institution,
					token: token.token,
					tokenCreatedAt: token.createdAt,
					tokenExpiresAt: token.expires,
					archived: true
				},
				'Institution deleted'
			);
		}
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};

export { deleteInstitution, getInstitution, updateInstitution };
