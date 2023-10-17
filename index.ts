/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
require('dotenv').config();
import 'module-alias/register';
import app_init from './app_init';
import { NextFunction, Request, Response } from 'express';
import logger from './src/libs/logger';
import  { sendErrorMessage } from './src/middleware/utils/middleware_error_handler';
import authMiddleware from './src/middleware/auth';
import SendResponse from './src/middleware/utils/send_response';
import apiRouter from './src/routes';
import { queryParametersMiddleware } from './src/middleware/utils/query_params';

import express from 'express';

const app = express();

app_init()
    .then(_ => {
        app.set('strict routing', false);

        // Attach the custom response function to req.sendResponse
        app.use((req: Request, res: Response, next: NextFunction) => {
            req.sendResponse = new SendResponse(req, res);
            if (req.sendResponse) next();
        });

        app.use(express.urlencoded({ extended: true }), express.json({ limit: '10mb' }));

        app.use(authMiddleware, queryParametersMiddleware);

        app.use((err: any, req: Request, res: Response, next: NextFunction) => sendErrorMessage(req, err, next));

        app.use('/api', apiRouter);

        app.get('/', (req: Request) => req.sendResponse?.respond('v0.1-alpha'));
        // Send API documentation on this route
        app.all('*', (req: Request) => req.sendResponse.error(404, 'No endpoint matching: ' + req.path));
        // /start express server and listen on port 3000 exporting the app
        app.listen(process.env.PORT || 3000, () => logger.debug(`Server started on port ${process.env.PORT || 3000}`));
    })
    .catch(err => {
        logger.error(err);
        process.exit(1);
    });
