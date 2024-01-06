/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { json } from 'body-parser';
import { Router } from 'express';
import refreshToken from '../../controller/auth/refresh_token';
import registerToken from '../../controller/auth/register_token';
import recoverToken from '../../controller/auth/recover_token';

const authRouter = Router();

authRouter.get('/refresh', refreshToken);

authRouter.post('/register', json(), registerToken);

authRouter.post('/recover', json(), recoverToken);

export default authRouter;
