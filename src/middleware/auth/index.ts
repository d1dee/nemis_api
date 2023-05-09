/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { NextFunction, Request, Response } from 'express';
import { decode, JsonWebTokenError, TokenExpiredError, verify } from 'jsonwebtoken';
import mongoose from 'mongoose';
import institution_schema from '../../database/institution';
import tokenSchema from '../../database/token';
import { DbInstitution, TokenFromDb } from '../../../types/nemisApiTypes';
import logger from '../../libs/logger';
import CustomError from '../../libs/error_handler';
import { sendErrorMessage } from '../utils/middlewareErrorHandler';

export default async (req: Request, res: Response, next: NextFunction) => {
	try {
		// If a path is /api/auth/register , skip auth middleware
		if (['/api/auth/register'].includes(req.path) || !/^\/api\//.test(req.path)) {
			logger.debug('Skipping auth middleware');
			logger.info('Path is ' + req.path);
			return next();
		}

		const authMethod = <string | undefined>req.headers?.authorization?.split(' ')[0];
		const token = <string | undefined>req.headers?.authorization?.split(' ')[1];
		if (!authMethod || authMethod != 'Bearer' || !token) {
			throw {
				code: 403,
				message: 'Forbidden. Invalid auth method or token',
				cause: 'Token must be of type Bearer'
			};
		}
		logger.info('Token received, verifying');
		logger.debug('Token: ' + token);
		if (!token) {
			throw {
				code: 403,
				message: 'Forbidden, token is undefined',
				cause: 'An empty token was received'
			};
		}
		//Get token value to check if it's revoked
		let decodedToken = decode(token);
		if (
			!decodedToken ||
			typeof decodedToken === 'string' ||
			!decodedToken?.id ||
			!mongoose.isValidObjectId(decodedToken.id)
		) {
			throw new CustomError('Forbidden. Invalid token. Token does not contain an id or id is an invalid mongoose _id', 403);
		}
		let tokenFromDb = <TokenFromDb | undefined>(
			await tokenSchema.findById(decodedToken.id).lean()
		);
		if (!tokenFromDb) {
			throw { code: 403, message: 'Forbidden. Invalid token' };
		}
		if (tokenFromDb.archived || tokenFromDb.revoked) {
			throw new CustomError(
				'Forbidden. This token is archived, please refresh token or contact your administrator',
				403,
				'revoked_token'
			);
		}
		if (!tokenFromDb.tokenSecret) {
			logger.warn('Token secret is missing');
			throw new CustomError('Token secret is missing.', 500, 'internal_server_error');
		}
		if (req.path === '/api/auth/refresh') {
			logger.debug('Token refresh');
			req.token = tokenFromDb;
			req.decodedToken = decodedToken;
			return next();
		} else if (Date.parse(tokenFromDb.expires.toString()) < Date.now()) {
			logger.debug('Token has expired');
			throw { code: 403, message: 'Forbidden. Token has expired, please refresh' };
		}

		//Verify the token
		let verifiedToken = verify(token, tokenFromDb.tokenSecret);
		if (!verifiedToken || typeof verifiedToken === 'string') {
			throw new CustomError('Forbidden. Invalid token. Token must be of type Bearer', 403);
		}
		logger.debug('Token verifiedToken');
		logger.debug('Token: ' + JSON.stringify(verifiedToken));
		// Find an institution in the token
		let institution = <DbInstitution>(
			await institution_schema.findById(tokenFromDb?.institutionId).lean()
		);
		if (!institution) {
			throw new CustomError(`Institution not found Institution with id ${tokenFromDb?.institutionId?.toString()} not found.`
				, 404);
		}
		// todo: Make sure to remove sensitive data from endpoints that
		//  do not need it
		req.institution = institution;
		req.token = tokenFromDb;
		req.isValidToken = true;
		// todo: If track login and sync local database if user hasn't
		//  logged in a while.
		//  This should happen in the background
		return next();
	} catch (err: any) {
		if (err instanceof TokenExpiredError) {
			logger.warn(err.message);
			err = { code: 403, message: 'Forbidden. Token expired', cause: err.message };
		}
		if (err instanceof JsonWebTokenError || err instanceof SyntaxError) {
			logger.warn(err.message);
			err = { code: 403, message: 'Forbidden. Invalid token', cause: err.message };
		}
		if (!err) {
			logger.error(err);
			err = { code: 500, message: 'Internal Server Error', cause: err.message };
		}
		sendErrorMessage(req, err);
	}
};
