/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { json } from 'body-parser';
import { Router } from 'express';
import refreshToken from '@middleware/auth/refresh_token';
import registerToken from '@middleware/auth/register_token';
import recoverToken from '@middleware/auth/recover_token';

const authRouter = Router();

authRouter.get('/refresh', refreshToken);

authRouter.post('/register', json(), registerToken);

authRouter.post('/recover', json(), recoverToken);

export default authRouter;
