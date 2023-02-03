/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

require('dotenv').config();

import express = require('express');
import db from './src/database';
import {ExtendedRequest} from './src/interfaces';
import logger from './src/libs/logger';
import authMiddleware from './src/middleware/auth';
import middlewareErrorHandler from './src/middleware/middlewareErrorHandler';
import queryParamsMiddleware from './src/middleware/query_params';
import request_body_validation from './src/middleware/request_body_validation';
import Response from './src/middleware/response';
import apiRouter from './src/routes';

const response = new Response();

const app = express();
try {
	db()
		.then(_ => logger.info('Connected to database'))
		.catch(err => {
			logger.error(err);
			process.exit(1);
		});

	app.use(
		express.urlencoded({extended: true}),
		express.json(),
		response.set.bind(response),
		(req: ExtendedRequest, _, next) => {
			req.response = response;
			next();
		},
		authMiddleware,
		queryParamsMiddleware,
		request_body_validation
	);
	app.use(middlewareErrorHandler);
	app.set('strict routing', false);
	app.use('/api', apiRouter);

	app.get('/', () => response.respond('Hello world')); // Send API documentation on this route
	app.all('*', req => response.respond({}, 'No endpoint matching: ' + req.path));
	//app.use(sync_db)
} catch (err) {
	logger.error(err);
	response.error(500, 'Internal Server Error', [err.message]);
}

//start express server and listen on port 3000 exporting the app
app.listen(3000, () => logger.debug('Server started on port 3000'));
