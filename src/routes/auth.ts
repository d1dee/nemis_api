/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import * as bodyParser from 'body-parser';
import {Router} from 'express';
import {ExtendedRequest} from '../interfaces';
import refreshToken from '../middleware/auth/refresh_token';
import registerToken from '../middleware/auth/register_token';

const authRouter = Router();

authRouter.use((req: ExtendedRequest, _, next) => {
	if (req.path === '/refresh' && req.method !== 'GET') {
		return req.response.error(405, 'Method not allowed', [
			'Only GET requests are allowed on this route'
		]);
	}
	if (req.path === '/register' && req.method !== 'POST') {
		return req.response.error(405, 'Method not allowed', [
			'Only POST requests are allowed on this route'
		]);
	}
	next();
});

authRouter.get('/refresh', async (req: ExtendedRequest) => refreshToken(req));

authRouter.post('/register', bodyParser.json(), (req: ExtendedRequest) => registerToken(req));

export default authRouter;
