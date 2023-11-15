/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { NATIONALITY } from "@libs/constants";

let dateTimeSchema = {
    UTCTimestamp: { required: true, type: Date },
    formattedDate: { required: true, type: String },
    timeZone: { required: true, type: String }
};

let archiveSchema = {
    isArchived: { type: Boolean, default: false },
    archivedOn: {
        UTCTimestamp: Date,
        formattedDate: String,
        timeZone: String
    },
    reason: String
};

let geoLocationSchema = {
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
};
export { dateTimeSchema, geoLocationSchema, archiveSchema };
