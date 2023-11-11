/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose from "mongoose";
import { dateTimeSchema } from "@database/shared_schemas";
import { dateTime } from "@libs/converts";

export const nemisApiSchema = new mongoose.Schema({
    name: String,
    dob: String,
    upi: String,
    gender: String,
    birthCertificateNo: String,
    classCode: Number,
    grade: String,
    isSpecial: Boolean,
    nhifNo: Number,
    isLearner: Boolean,
    currentInstitution: {
        name: String,
        code: String,
        type: String,
        level: String
    },
    nationality: String,
    countyNo: Number,
    subCountyNo: Number,
    father: {
        name: String,
        id: String,
        phone: String,
        upi: String
    },
    mother: {
        name: String,
        id: String,
        phone: String,
        upi: String
    },
    guardian: {
        name: String,
        id: String,
        phone: String,
        upi: String
    },
    postalAddress: String,
    admitted: Boolean,
    requested: Boolean,
    citizenship: String,
    indexNo: String,
    marks: Number,
    placementHistory: String,
    religionCode: String,
    reported: {
        date: String,
        institutionName: String,
        institutionCode: String
    },
    learnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'learner'
    },
    disability: {
        b: String,
        d: String,
        l: String,
        p: String
    },
    schoolReported: {
        originalString: String,
        code: String,
        name: String,
        schoolType: String,
        category: String
    },
    schoolAdmitted: {
        originalString: String,
        code: String,
        name: String,
        schoolType: String,
        category: String
    },
    schoolSelected: {
        level: String,
        code: String,
        name: String
    },
    selectionMethod: String,
    previousSchool: {
        name: String,
        code: String
    },
    preferredSchools: {
        national: {
            first: String,
            second: String,
            third: String,
            fourth: String
        },
        extraCounty: {
            first: String,
            second: String,
            third: String
        },
        county: {
            first: String,
            second: String
        },
        secondary: {
            first: String,
            second: String
        }
    },
    choiceNo: String,
    districtRank: Number,
    nationalRank: Number,

    lastUpdate: { type: dateTimeSchema, default: dateTime() },

    address: String,

    medicalCondition: String,
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'institution' },
    learner: { type: mongoose.Schema.Types.ObjectId, ref: 'learner' }
});

export default mongoose.model('nemisApiResults', new mongoose.Schema());
