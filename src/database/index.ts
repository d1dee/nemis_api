/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import mongoose from 'mongoose';
import logger from '../libs/logger';
import continuing_learner from './continuing_learner';
import institution_model from './institution';
import learner_model from './learner';
import token_model from './token';

mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);
mongoose.set('autoIndex', true);

export default async (dbUrl: string) => {
	try {
		await mongoose.connect(dbUrl);

		// Sync indexes
		const models = [token_model, learner_model, institution_model, continuing_learner];
		const syncIndexes = await Promise.allSettled(models.map(x => x.createIndexes()));

		let indexSyncErrors = [] as Promise<void>[];

		let i = 0;

		for (const index of syncIndexes) {
			if (index.status === 'fulfilled') {
				i++;
				continue;
			}

			// If indexes failed, drop indexes and create new indexes
			logger.debug('Dropping indexes');

			await models[i].collection.dropIndexes();
			indexSyncErrors.push(models[i].createIndexes());
			i++;
		}

		// Await new indexes to be created
		if (indexSyncErrors.length > 0) await Promise.all(indexSyncErrors);
		logger.info('Synced indexes');
	} catch (err) {
		throw err;
	}
};
