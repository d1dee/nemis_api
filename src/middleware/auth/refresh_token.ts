/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { randomFillSync } from 'crypto';
import { sign, TokenExpiredError, verify } from 'jsonwebtoken';
import institution_schema from '../../database/institution';
import token_schema from '../../database/token';
import logger from '../../libs/logger';
import { Request } from 'express';
import CustomError from '../../libs/error_handler';
import { sendErrorMessage } from '../utils/middlewareErrorHandler';

export default (req: Request) => {
	try {
		let token = req.token;
		let decodedToken = req.decodedToken;

		if (!token || !token.token || !decodedToken) {
			throw new CustomError('Forbidden. No token was received by the API.', 403);
		}

		//Get token value to check if it's revoked
		if (!decodedToken?.id) {
			throw new CustomError('Forbidden. Invalid token. Token does not contain an id.', 403);
		}

		verify(token.token, token.tokenSecret, async err => {
			if (err) {
				if (err instanceof TokenExpiredError) {
					//Token refresh
					logger.debug(
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
					req.sendResponse.setHeaders({
						Authorization: 'Bearer ' + tokenDb.token,
						'Access-Control-Expose-Headers': 'Authorization Expires',
						Expires: new Date(Date.now() + 2.592e9).toUTCString()
					});

					return req.sendResponse.respond({
						success: true,
						message: 'Token refreshed',
						data: { token: tokenDb.token }
					});
				} else {
					throw new CustomError('Forbidden. Invalid token', 403);
				}
			} else {
				return req.sendResponse.respond({
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
	} catch (err: any) {
		logger.error(err);
		sendErrorMessage(req, err);
	}
};
