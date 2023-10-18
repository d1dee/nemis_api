/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import CustomError from './src/libs/error_handler';
import connectDb from './src/database/index';
import logger from './src/libs/logger';

export default async () => {
	try {
		let dbUrl = process.env.DB_URL,
			nemisApiAuth = process.env.NEMIS_API_AUTH,
			encryptionKey = process.env.ENCRYPTION_KEY;
		// check all env variables are set
		if (!dbUrl || !nemisApiAuth || !encryptionKey) {
			throw new CustomError(
				'Ensure all env fields are set. Not all environment variables are sent.',
				1,
				'init_failed'
			);
		}
		// Wait database to connect
		await connectDb(dbUrl);
		logger.info('Connected to database');
	} catch (err) {
		throw err;
	}
};
