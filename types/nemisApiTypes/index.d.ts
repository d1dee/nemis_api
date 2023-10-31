/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */
import { z as zod } from "zod";
import mongoose, { Document } from "mongoose";
import { completeLearnerSchema, genderSchema, gradesSchema, nationalitiesSchema } from "@libs/zod_validation";
import {
    admissionApiResponseSchema,
    admissionSchema,
    listAdmittedLearnerSchema,
    listLearnerSchema,
    requestingJoiningLearnerSchema,
    searchLearnerSchema
} from "@libs/nemis/validations";

/**
 * Continuing learner_router for a database
 */
export type ContinuingLearnerType = Omit<NemisLearnerFromDb, 'ObjectId'> & {
    institutionId: mongoose.Types.ObjectId;
    continuing: boolean;
    birthCertificateNo: string;
    indexNo: string;
};

/**
 * A learner_router joining the school for the first time ie form 1 in secondary schools.
 */
export type RequestingJoiningLearner = zod.infer<typeof requestingJoiningLearnerSchema>;

/**
 * A standard learner_router, this is a base learner_router where all other learners are derived from
 */
export type CompleteLearner = zod.infer<typeof completeLearnerSchema> & {
    continuing?: boolean;
};

export type CompleteDatabaseLearner = CompleteLearner & {
    error?: string;
    nemisApiResultsId?: mongoose.Types.ObjectId;
    institutionId: mongoose.Types.ObjectId;
    admitted?: boolean;
    reported?: boolean;
    nhifNo?: number;
};

/**
 * Learner returned by http://nemis.education.go.ke/Learner/Listlearners.aspx on the NEMIS website
 */
export type ListLearner = zod.infer<typeof listLearnerSchema> & {
    doPostback: string;
    grade: Grades;
};

/**
 * List of learners awaiting biodata capture and is returned by http://nemis.education.go.ke/Admission/Listlearnersrep.aspx
 */

export type ListAdmittedLearner = zod.infer<typeof listAdmittedLearnerSchema>;

export type Grades = zod.infer<typeof gradesSchema>;
export type Nationalities = zod.infer<typeof nationalitiesSchema>;
export type Gender = zod.infer<typeof genderSchema>;
export type AdmissionApiResults = zod.infer<typeof admissionSchema>;

export type AdmitApiResponses = zod.infer<typeof admissionApiResponseSchema>;
export type SearchLearnerApiResponses = zod.infer<typeof searchLearnerSchema>;

export type CaptureBiodataResponse = {
    upi?: string;
    message: string;
    alertMessage?: string;
};

export type DateTimeSchema = {
    UTCTimestamp: Date;
    formattedDate: string;
    timeZone: string;
};

export interface RequestingLearner extends BasicName {
    no?: number;
    name: string;
    adm: string;
    gender: string;
    kcpeYear: number;
    indexNo: string;
    birthCertificateNo: string;
    grade: Grades;
    remarks: string;
    upi?: string;
    postback?: string;
}

//Learner
export interface BasicLearner {
    adm: string;
    name: string;
    grade: Grades;
    stream?: string;
    upi?: string;
    gender: string;
    dob: DateTimeSchema; //parse to date
}

export interface BasicContact {
    name?: string;
    id?: string;
    tel?: string;
}

export interface Contacts {
    father?: BasicContact;
    mother?: BasicContact;
    guardian?: BasicContact;
    address?: string;
}

export interface Counties {
    countyNo?: number;
    subCountyNo?: number;
    county?: string;
    subCounty?: string;
}

export interface NemisLearner extends BasicLearner, Contacts, Counties {
    birthCertificateNo?: string;
    nhifNo?: number;
    continuing?: boolean;
    medicalCondition?: string;
    isSpecial?: boolean;
    age?: number;
    marks?: number;
    indexNo?: string;
    nationality?: string;
    remarks?: string;
    kcpeYear?: number;
}

export interface NemisLearnerFromDb extends NemisLearner, Document {
    error?: string;
    nemisApiResultsId?: mongoose.Types.ObjectId;
    institutionId: mongoose.Types.ObjectId;
    admitted?: boolean;
    reported?: boolean;
}

export interface BasicName {
    surname: string;
    firstname: string;
    otherName: string;
}

export interface SelectedLearner {
    indexNo: string;
    name: string;
    gender: string;
    yearOfBirth: number;
    marks: number;
    subCounty: string;
}

export interface StateObject {
    __VIEWSTATEGENERATOR: string;
    __EVENTARGUMENT?: string;
    __VIEWSTATE: string;
    __VIEWSTATEENCRYPTED?: string;
    __LASTFOCUS?: string;
    __EVENTTARGET?: string;
    __EVENTVALIDATION: string;
}

export interface ParsedLabel {
    originalString?: string;
    code?: string;
    name?: string;
    type?: string;
    category?: string;
}

export interface AdmitApiCall {
    name: string;
    gender: string;
    citizenship: string;
    indexNo: string;
    marks: string;
    disability?: {
        b: string;
        d: string;
        l: string;
        p: string;
    };
    schoolAdmitted?: ParsedLabel;
    schoolSelected?: {
        level: string;
        code: string;
        name: string;
    };
    selectionMethod?: string;
    previousSchool?: {
        name: string;
        code: string;
    };
    preferredSchools?: {
        national?: {
            first?: string;
            second?: string;
            third?: string;
            fourth?: string;
        };
        extraCounty?: {
            first?: string;
            second?: string;
            third?: string;
        };
        county?: {
            first?: string;
            second?: string;
        };
        secondary?: {
            first?: string;
            second?: string;
        };
    };
}

export interface RequestedJoiningLearner extends ApprovedLearner {}

export interface SchoolSelected {
    originalString?: string;
    code: string;
    name: string;
    type: string;
    category: string;
}

export interface ApprovedLearner {
    no?: string;
    indexNo?: string;
    name?: string;
    gender?: string;
    marks?: string;
    schoolSelected?: SchoolSelected;
    requestedBy?: string;
    parentId?: string;
    parentTel?: string;
    dateCaptured?: string;
    approved?: {
        by?: string;
        on?: string;
    };
    status?: string;
}

export interface ContinuingLearnerApiResponse {
    xcat?: string;
    isLearner: boolean;
    isLearnerDescription?: string;
    upi?: string;
    names?: string;
    surname?: string;
    firstName?: string;
    otherNames?: string;
    institutionName?: string;
    phoneNumber?: string;
    emailAddress?: string;
    postalAddress?: string;
    fatherUpi?: string;
    motherUpi?: string;
    guardianUpi?: string;
    fatherName?: string;
    fatherIdno?: string;
    fatherContacts?: string;
    motherName?: string;
    motherIdno?: string;
    motherContacts?: string;
    guardianContacts?: string;
    guardianIdno?: string;
    guardianName?: string;
    specialMedicalCondition?: string;
    anySpecialMedicalCondition?: string;
    institutionCode?: string;
    subCountyCode?: string;
    nationality?: string;
    gender?: string;
    lgender?: string;
    dob?: string;
    doB2?: string;
    isDateDOB?: string;
    birthCertificateNo?: string;
    idNo?: string;
    disabilityCode?: string;
    classCode?: string;
    countyCode?: string;
    countyLearner?: string;
    subCountyLearner?: string;
    specialNeedsList?: string;
    fatherEmail?: string;
    motherEmail?: string;
    guardianEmail?: string;
    institutionType?: string;
    institutionLevelCode?: string;
    nhifNo?: string;
    className?: string;
    levelName?: string;
}
