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

// @ts-ignore
export default async (dbUrl: string) => {
	try {
		// Connect db
		await mongoose.connect(dbUrl);
		// Sync indexes
		const models = [token_model, learner_model, institution_model, continuing_learner];
		const syncIndexes = await Promise.allSettled(models.map(x => x.createIndexes()));
		let indexSyncErrors = [],
			i = 0;
		for (const x of syncIndexes) {
			if (x.status != 'rejected') continue;
			if (x.reason?.code === 86) {
				// If indexes failed, drop indexes and create new indexes
				logger.debug('Dropping indexes');
				await models[i].collection.dropIndexes();
				indexSyncErrors.push(models[i].createIndexes());
			}
			i++;
		}
		// Await new indexes to be created
		await Promise.all(indexSyncErrors);
		logger.info('indexes synced');
	} catch (err) {
		throw err;
	}
};
