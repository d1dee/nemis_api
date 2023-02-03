/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import mongoose from 'mongoose';
import logger from '../libs/logger';
import archive_institution_model from './archive_institution';
import continuing_learner from './continuing_learner';
import institution_model from './institution';
import learner_model from './learner';
import token_model from './token';

if (!process.env.DB_URL) throw new Error('DB_URL not found');

mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);
mongoose.set('autoIndex', true);

// @ts-ignore
export default async () =>
	await mongoose
		.connect(process.env.DB_URL)
		.then(async db => {
			const models = [
				token_model,
				learner_model,
				institution_model,
				archive_institution_model,
				continuing_learner
			];
			const syncIndexes = await Promise.allSettled(models.map(x => x.createIndexes()));
			let erroredIndexes = [],
				i = 0;
			for (const x of syncIndexes) {
				if (x.status != 'rejected') continue;
				if (x.reason?.code === 86) {
					logger.debug('Dropping indexes');
					await models[i].collection.dropIndexes();
					erroredIndexes.push(models[i].createIndexes());
				}
				i++;
			}
			await Promise.all(erroredIndexes);
			logger.info('indexes synced');
			return db;
		})
		.catch(err => {
			logger.error(err);
			process.exit(1);
		});
