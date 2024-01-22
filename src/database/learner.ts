/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import mongoose from 'mongoose';
import { GRADES, MEDICAL_CONDITIONS } from '@libs/constants';
import { archiveSchema, dateTimeSchema, geoLocationSchema } from '@database/shared_schemas';
import { dateTime } from '@libs/converts';

export const parentInfoSchema = {
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
};

export const learnerTransferSchema = {
    transferredOn: { type: dateTimeSchema, required: true },
    reason: String,
    method: {
        type: String,
        enum: ["in,'out"] as const,
        required: true
    },
    institution: {
        code: { type: String },
        name: { type: String, required: true },
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'institution' }
    }
};

export const continuingLearnerSchema = {
    remarks: String,
    postback: {
        type: String,
        index: {
            unique: true,
            partialFilterExpression: { postback: { $exists: true, $type: 'string' } }
        }
    }
};

export const learnerSchema = new mongoose.Schema({
    //Basic learner details
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
    gender: {
        type: String,
        index: true,
        required: true,
        enum: ['male', 'female'] as const
    },
    dob: { type: dateTimeSchema, required: true },

    // Learner educational details
    birthCertificateNo: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
        collation: { locale: 'en', strength: 2, numericOrdering: true }
    },
    upi: {
        type: String,
        sparse: true,
        unique: true,
        partialFilterExpression: {
            upi: { $exists: true, $type: 'string', $nin: ['', 0, null] }
        },
        collation: { locale: 'en', strength: 2 }
    },
    grade: {
        required: true,
        type: String,
        enum: GRADES,
        index: true
    },
    stream: {
        type: String,
        index: true,
        collation: { locale: 'en', strength: 2 }
    },
    kcpeYear: { type: Number, default: new Date().getFullYear() - 1, required: true },
    indexNo: {
        type: String,
        sparse: true,
        partialFilterExpression: {
            indexNo: { $exists: true, $type: 'string', $nin: ['', 0, null] }
        }
    },
    marks: Number,

    institutionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'institution',
        required: true
    },
    creationTimestamp: { type: dateTimeSchema, default: dateTime() },

    // A link between all scrapped data from nemis and APIs data
    nemisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'nemisLearner'
    },

    transfer: { type: learnerTransferSchema },
    // If learner was added as a continuing learner
    isContinuing: Boolean,
    continuing: continuingLearnerSchema,

    // Contacts details
    contactDetails: {
        father: parentInfoSchema,
        mother: parentInfoSchema,
        guardian: parentInfoSchema,
        address: String
    },

    geoLocationDetails: geoLocationSchema,

    isAdmitted: { type: Boolean, default: false },
    hasReported: { type: Boolean, default: false },
    isSpecial: { type: Boolean, required: true, default: false },
    medicalCondition: { type: String, enum: MEDICAL_CONDITIONS, default: 'none' },
    nhifNo: Number,
    archived: archiveSchema,
    error: {
        message: {
            type: String,
            index: true,
            collation: {
                locale: 'en',
                strength: 2
            }
        }
    }
});
export default mongoose.model('learner', learnerSchema);
