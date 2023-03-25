/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {JwtPayload} from 'jsonwebtoken';
import {DbInstitution} from '../../src/interfaces';
import {Nemis} from '../../src/libs/nemis';
import {QueryParams, TokenFromDb} from '../../src/middleware/interfaces';
import send_response from '../../src/middleware/send_response';

declare module 'express-serve-static-core' {
	interface Request {
		nemis: Nemis;
		isValidToken: boolean;
		decodedToken: JwtPayload;
		institution: DbInstitution;
		token: TokenFromDb;
		sendResponse: send_response;
		queryParams: QueryParams;
	}
}
