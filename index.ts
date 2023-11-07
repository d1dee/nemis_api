/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */
require('dotenv').config();
import 'module-alias/register';
import app_init from './app_init';
import express, { NextFunction, Request, Response } from 'express';
import { sendErrorMessage } from '@middleware/utils/middleware_error_handler';
import authMiddleware from './src/middleware/auth';
import SendResponse from './src/middleware/utils/send_response';
import apiRouter from './src/routes';

const app = express();

app_init()
    .then(_ => {
        app.set('strict routing', false);

        // Attach the custom response function to req.respond
        app.use((req: Request, res: Response, next: NextFunction) => {
            req.respond = new SendResponse(req, res);
            if (req.respond) next();
            else throw new Error('Failed to set up response function.');
        });

        app.use(
            authMiddleware,
            express.urlencoded({ extended: true }),
            express.json({ limit: '10mb' }),
            (err: any, req: Request, res: Response, next: NextFunction) =>
                sendErrorMessage(req, err, next)
        );

        app.use('/api', apiRouter);

        app.get('/', (req: Request) => req.respond.sendResponse('v0.1-alpha'));
        // Send API documentation on this route
        app.all('*', (req: Request) =>
            req.respond.sendError(404, 'No endpoint matching: ' + req.path)
        );
        // /start express server and listen on port 3000 exporting the app
        app.listen(process.env.PORT || 3000, () =>
            console.debug(`Server started on port ${process.env.PORT || 3000}`)
        );
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
