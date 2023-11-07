/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */
import { z as zod } from "zod";
import mongoose, { Document } from "mongoose";
import { genderSchema, gradesSchema } from "@libs/zod_validation";

export type Grades = zod.infer<typeof gradesSchema>;
export type Gender = zod.infer<typeof genderSchema>;

export type CaptureBiodataResponse = {
    upi?: string;
    message: string;
    alertMessage?: string;
};

//Learner
export interface BasicLearner {
    adm: string;
    name: string;
    grade: Grades;
    stream?: string;
    upi?: string;
    gender: string;
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

export interface SchoolSelected {
    originalString?: string;
    code: string;
    name: string;
    type: string;
    category: string;
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
