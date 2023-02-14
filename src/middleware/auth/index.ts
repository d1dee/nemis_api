/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {NextFunction, Response} from 'express';
import {decode, JsonWebTokenError, TokenExpiredError, verify} from 'jsonwebtoken';
import mongoose from 'mongoose';
import institution_schema from '../../database/institution';
import tokenSchema from '../../database/token';
import {DbInstitution, ExtendedRequest} from '../../interfaces';
import logger from '../../libs/logger';
import {JWTToken, TokenFromDb} from '../interfaces';

export default async (req: ExtendedRequest, res: Response, next: NextFunction) => {
	try {
		// If path is /api/auth/register , skip auth middleware
		if (['/api/auth/register'].includes(req.path) || !/^\/api\//.test(req.path)) {
			logger.debug('Skipping auth middleware');
			logger.trace('Path is ' + req.path);
			return next();
		}

		const authMethod = req.headers?.authorization?.split(' ')[0];
		const token = req.headers?.authorization?.split(' ')[1];

		if (token) {
			if (authMethod === 'Bearer') {
				let token = req.headers.authorization.split(' ')[1];

				logger.info('Token received, verifying');
				logger.trace('Token: ' + token);

				//Get token value to check if it's revoked
				let decodedToken = decode(token) as JWTToken;
				if (!decodedToken?.id) {
					throw {
						code: 403,
						message: 'Forbidden. Invalid token',
						cause: 'Token does not contain an id'
					};
				}
				if (!mongoose.isValidObjectId(decodedToken.id)) {
					throw {
						code: 403,
						message: 'Forbidden. Invalid token',
						cause: 'Token id is not a valid ObjectId'
					};
				}
				let tokenFromDb = await tokenSchema.findById(decodedToken.id).lean();
				if (!tokenFromDb) {
					throw {code: 403, message: 'Forbidden. Invalid token'};
				}
				if (tokenFromDb.archived) {
					throw {
						code: 403,
						message:
							'Forbidden. Institution linked to this token is archived, please re-register or contact your administrator',
						cause: 'Token is revoked'
					};
				}
				if (tokenFromDb.revoked) {
					logger.debug('Token is revoked');
					throw {code: 403, message: 'Forbidden. Token is revoked'};
				}
				if (!tokenFromDb.tokenSecret) {
					logger.debug('Token secret is missing');
					throw {code: 403, message: 'Forbidden. Token secret is missing'};
				}
				if (req.path === '/api/auth/refresh') {
					logger.debug('Token refresh');
					req.token = <TokenFromDb>(<unknown>tokenFromDb);
					req.decodedToken = decodedToken;
					return next();
				} else if (Date.parse(tokenFromDb.expires.toString()) < Date.now()) {
					logger.debug('Token has expired');
					throw {code: 403, message: 'Forbidden. Token has expired, please refresh'};
				}

				//Verify the token
				verify(token, tokenFromDb.tokenSecret, async (err, decodedToken) => {
					if (typeof decodedToken === 'object') {
						logger.debug('Token decodedToken');
						logger.trace('Token: ' + JSON.stringify(decodedToken));
						// Find institution in the token
						institution_schema
							.findById(tokenFromDb.institutionId)
							.lean()
							.then(institution => {
								if (!institution) {
									throw {
										code: 404,
										message: 'Institution not found',
										cause: `Institution with id ${tokenFromDb?.institutionId} not found`
									};
								}
								// todo: Make sure to remove sensitive data from endpoints that
								//  do not need it
								req.institution = <DbInstitution>(<unknown>institution);
								req.token = <TokenFromDb>(<unknown>tokenFromDb);
								req.decodedToken = decodedToken as JWTToken;
								// todo: If track login and sync local database if user hasn't
								//  logged in a while. This should happen in the background
								return next();
							})
							.catch(err => {
								logger.error(err);
								throw {
									code: 500,
									message: 'Internal Server Error',
									cause: err.message
								};
							});
					}
				});
			} else {
				throw {
					code: 403,
					message: 'Forbidden. Invalid token',
					cause: 'Token must be of type' + ' Bearer'
				};
			}
		} else {
			throw {code: 403, message: 'Forbidden. No token supplied'};
		}
	} catch (err) {
		if (err instanceof TokenExpiredError) {
			logger.warn(err.message);
			err = {code: 403, message: 'Forbidden. Token expired', cause: err.message};
		}
		if (err instanceof JsonWebTokenError || err instanceof SyntaxError) {
			logger.warn(err.message);
			err = {code: 403, message: 'Forbidden. Invalid token', cause: err.message};
		}
		if (!err) {
			logger.error(err);
			err = {code: 500, message: 'Internal Server Error', cause: err.message};
		}
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
