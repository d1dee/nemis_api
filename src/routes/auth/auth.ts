/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { json } from 'body-parser';
import { Router } from 'express';
import refreshToken from '../../middleware/auth/refresh_token';
import registerToken from '../../middleware/auth/register_token';

const authRoute = Router();

authRoute.get('/refresh', refreshToken);

authRoute.post('/register', json(), registerToken);

export default authRoute;
