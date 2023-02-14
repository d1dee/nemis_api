/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {randomFillSync} from 'crypto';
import {JsonWebTokenError, sign, TokenExpiredError, verify} from 'jsonwebtoken';
import institution_schema from '../../database/institution';
import token_schema from '../../database/token';
import {ExtendedRequest} from '../../interfaces';
import logger from '../../libs/logger';

export default (req: ExtendedRequest) => {
	let response = req.response;
	try {
		let token = req.token;
		let decodedToken = req.decodedToken;
		if (!token || !decodedToken) {
			throw {code: 403, message: 'Forbidden. No token provided'};
		}
		//Get token value to check if it's revoked
		if (!decodedToken?.id) {
			throw {
				code: 403,
				message: 'Forbidden. Invalid token',
				cause: 'Token does not contain an id'
			};
		}
		verify(token.token, token.tokenSecret, async err => {
			if (err) {
				if (err instanceof TokenExpiredError) {
					//Token refresh

					logger.trace(
						JSON.stringify(decodedToken) + ' has expired and is being refreshed'
					);
					logger.debug('Token expired, sending a new token');

					delete decodedToken.exp;
					delete decodedToken.iat;

					let tokenSecret = randomFillSync(Buffer.alloc(32)).toString('hex');
					logger.debug('Token secret: ' + tokenSecret);

					let tokenDb = await token_schema.create({
						token: sign(decodedToken, tokenSecret, {
							expiresIn: '0 seconds'
						}),
						tokenSecret: tokenSecret,
						institutionId: token.institutionId
					});

					await institution_schema.findByIdAndUpdate(token.institutionId, {
						token: tokenDb._id
					});
					await token_schema.findByIdAndUpdate(token._id, {
						revoked: {
							on: Date.now(),
							by: decodedToken.id,
							reason: 'Token refresh'
						}
					});
					//response.setCookie(tokenDb.token);
					response.setHeaders({
						Authorization: 'Bearer ' + tokenDb.token,
						'Access-Control-Expose-Headers': 'Authorization Expires',
						Expires: new Date(Date.now() + 2.592e9).toUTCString()
					});

					return response.respond({
						success: true,
						message: 'Token refreshed',
						data: {token: tokenDb.token}
					});
				} else if (err instanceof JsonWebTokenError) {
					throw {code: 403, message: 'Forbidden. Invalid token', cause: err};
				} else {
					logger.error(err);
					throw {
						code: 500,
						message: 'Internal Server Error',
						cause: 'An unknown error occurred'
					};
				}
			} else {
				return response.respond({
					success: true,
					message: 'Your token is still valid',
					data: {
						token: token.token,
						expires: new Date(token.expires).toUTCString(),
						created: new Date(token.createdAt).toUTCString()
					}
				});
			}
		});
	} catch (err) {
		logger.error(err);
		req.response.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || ''
		);
	}
};
