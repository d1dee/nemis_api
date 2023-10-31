/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose from "mongoose";
import { GRADES, MEDICAL_CONDITIONS, NATIONALITY } from "@libs/zod_validation";
import { dateTimeSchema } from "@database/index";

export const parentInfoSchema = new mongoose.Schema({
    name: {
        type: String,
        index: true,
        collation: {
            locale: 'en',
            strength: 2
        }
    },
    tel: String,
    id: String
});

export const learnerSchema = new mongoose.Schema({
    adm: {
        type: String,
        unique: true,
        sparse: true,
        required: true,
        partialFilterExpression: {
            adm: { $exists: true, $type: 'string', $nin: ['', 0, null] }
        }
    },
    name: {
        type: String,
        required: true,
        index: true,
        collation: {
            locale: 'en',
            strength: 2
        }
    },
    dob: { type: dateTimeSchema, required: true },
    birthCertificateNo: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
        collation: { locale: 'en', strength: 2, numericOrdering: true }
    },
    marks: Number,
    grade: {
        required: true,
        type: String,
        enum: GRADES,
        index: true
    },
    indexNo: {
        type: String,
        sparse: true,
        partialFilterExpression: {
            indexNo: { $exists: true, $type: 'string', $nin: ['', 0, null] }
        }
    },
    continuing: { type: Boolean, required: true, default: false },
    upi: {
        type: String,
        sparse: true,
        unique: true,
        partialFilterExpression: {
            upi: { $exists: true, $type: 'string', $nin: ['', 0, null] }
        },
        collation: { locale: 'en', strength: 2 }
    },
    stream: {
        type: String,
        index: true,
        collation: { locale: 'en', strength: 2 }
    },
    institutionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'institution',
        required: true
    },
    // A link between all scrapped data from nemis and APIs data
    nemisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'nemisLearner'
    },
    // Api results from nemis apis
    nemisApiResultsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'nemisApiResults'
    },
    transfer: {
        transferredOn: { type: dateTimeSchema, required: true },
        transferReason: String,
        transferMethod: {
            type: String,
            enum: ["in,'out"] as const,
            required: true
        },
        institution: {
            code: { type: String, required: true },
            name: { type: String, required: true },
            _id: { type: mongoose.Schema.Types.ObjectId, ref: 'institution' }
        }
    },
    // If learner_router was added as a continuing learner_router
    continuingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'continuingLearner'
    },

    // Contacts details
    father: parentInfoSchema,
    mother: parentInfoSchema,
    guardian: parentInfoSchema,
    address: String,

    // County and sub-county details
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
    gender: {
        type: String,
        index: true,
        required: true,
        enum: ['male', 'female'] as const
    },
    nationality: { type: String, enum: NATIONALITY, default: 'kenya' },
    admitted: { type: Boolean, default: false },
    reported: { type: Boolean, default: false },
    isSpecial: { type: Boolean, required: true, default: false },
    medicalCondition: { type: String, enum: MEDICAL_CONDITIONS, default: 'none' },
    nhifNo: Number,
    kcpeYear: { type: Number, default: new Date().getFullYear(), required: true },
    archived: {
        isArchived: { type: Boolean, default: false },
        archivedOn: dateTimeSchema,
        reason: String
    },
    error: {
        type: String,
        index: true,
        collation: { locale: 'en', strength: 2 }
    }
});
export default mongoose.model('learner', learnerSchema);
