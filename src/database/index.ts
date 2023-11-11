/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose from "mongoose";
import institutionModel from "./institution";
import learnerModel from "./learner";
import tokenModel from "./token";
import nemisApiModel from "@database/nemis_api";

mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);
mongoose.set('autoIndex', true);

export default async (dbUrl: string) => {
    try {
        await mongoose.connect(dbUrl);

        // Sync indexes
        const models = [tokenModel, learnerModel, institutionModel, nemisApiModel];
        const syncIndexes = await Promise.allSettled(models.map(x => x.createIndexes()));

        let indexSyncErrors = [] as Promise<void>[];

        let i = 0;

        for (const index of syncIndexes) {
            if (index.status === 'fulfilled') {
                i++;
                continue;
            }

            // If indexes failed, drop indexes and create new indexes
            console.debug('Dropping indexes');

            await models[i].collection.dropIndexes();
            indexSyncErrors.push(models[i].createIndexes());
            i++;
        }

        // Await new indexes to be created
        if (indexSyncErrors.length > 0) await Promise.all(indexSyncErrors);
        console.info('Synced indexes');
    } catch (err) {
        throw err;
    }
};
