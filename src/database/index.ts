/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose from "mongoose";
import institutionModel from "./institution";
import learnerModel from "./learner";
import tokenModel from "./token";
import nemisApiModel from "@database/nemis_api";
import { NATIONALITY } from "@libs/zod_validation";

mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);
mongoose.set('autoIndex', true);

export const dateTimeSchema = new mongoose.Schema({
    UTCTimestamp: { required: true, type: Date },
    formattedDate: { required: true, type: String },
    timeZone: { required: true, type: String }
});

export const archiveSchema = new mongoose.Schema({
    isArchived: { type: Boolean, default: false },
    archivedOn: dateTimeSchema,
    reason: String
});

export const geoLocationSchema = new mongoose.Schema({
    county: {
        type: String,
        index: true,
        collation: { locale: 'en', strength: 2 }
    },
    subCounty: {
        type: String,
        index: true,
        collation: { locale: 'en', strength: 2 }
    },
    countyNo: Number,
    subCountyNo: Number,
    nationality: { type: String, enum: NATIONALITY, default: 'kenya' }
});

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
