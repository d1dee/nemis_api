/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { z } from 'zod';
import { dateTime } from '@libs/converts';
import {
    Z_GENDER,
    Z_GRADE,
    Z_NUMBER,
    Z_NUMBER_STRING,
    Z_PARSE_SCHOOL_ADMITTED,
    Z_STRING
} from '@libs/constants';
import { utcToZonedTime } from 'date-fns-tz';

export const Z_NEMIS_DATE = z.string().transform(x => {
    let dob = x.split('-');
    if (dob.length === 3) return dateTime(new Date([dob[1], dob[0], dob[2]].join('-')));
});

export const INSTITUTION_OWNER_TYPE = ['GOK', 'Mission', 'Private'] as const;
export const OWNERSHIP_DOCUMENT_TYPE = ['Lease', 'Title Deed', 'Agreement'] as const;
export const INSTITUTION_TYPE = ['Public', 'Private'] as const;
export const INSTITUTION_REGISTRATION_STATUS = ['Registered', 'Re-Registered', 'Suspended'] as const;
export const INSTITUTION_CATEGORY = [
    'Integrated',
    'Regular',
    'Regular with Special Unit',
    'Special School'
] as const;
export const INSTITUTION_LEVEL = [
    'ECDE',
    'Primary',
    'Secondary',
    'TTC',
    'TVET',
    'JSS',
    'A-Level',
    'Pre-vocational'
] as const;
export const Z_TRIM = z.string().trim();
export const INSTITUTION_MOBILITY_TYPE = ['Static', 'Mobile'] as const;
export const INSTITUTION_ACCOMMODATION_TYPE = ['Day', 'Boarding', 'Daya and Boarding'] as const;
export const INSTITUTION_RESIDENCE = ['Rural', 'Urban'] as const;
export const EDUCATION_SYSTEM = ['8.4.4/CBC', 'IGSCE', 'Both', 'TVET'] as const;
export const INSTITUTION_GENDER = ['Boys', 'Girls', 'Mixed'] as const;
export const Z_INST_GENDER = Z_TRIM.pipe(z.enum(INSTITUTION_GENDER));
export const Z_INST_OWNERSHIP_DOCUMENT = Z_TRIM.pipe(z.enum(OWNERSHIP_DOCUMENT_TYPE));
export const Z_INST_OWNERSHIP = Z_TRIM.pipe(z.enum(INSTITUTION_OWNER_TYPE));
export const Z_INST_EDUCATION_SYSTEM = Z_TRIM.pipe(z.enum(EDUCATION_SYSTEM));
export const Z_INST_RESIDENCE = Z_TRIM.pipe(z.enum(INSTITUTION_RESIDENCE));
export const Z_INST_MOBILITY = Z_TRIM.pipe(z.enum(INSTITUTION_MOBILITY_TYPE));

export const Z_INST_EDUCATION_LEVEL = Z_TRIM.pipe(z.enum(INSTITUTION_LEVEL)).transform(level => ({
    description: level,
    code: INSTITUTION_LEVEL.findIndex(x => level === x) + 1
}));
export const Z_INST_CATEGORY = Z_TRIM.pipe(z.enum(INSTITUTION_CATEGORY));
export const Z_INST_ACCOMMODATION = Z_TRIM.pipe(z.enum(INSTITUTION_ACCOMMODATION_TYPE));
export const Z_INST_REGISTRATION_STATUS = Z_TRIM.pipe(z.enum(INSTITUTION_REGISTRATION_STATUS));
export const Z_INST_TYPE = Z_TRIM.pipe(z.enum(INSTITUTION_TYPE));

export const Z_RESULTS_SHAPE = z.object({
    indeX_NO: Z_STRING,
    ge: Z_STRING,
    name: Z_STRING,
    school_Name: Z_STRING,
    tot: Z_STRING,
    district_code: Z_STRING,
    district_name: Z_STRING,
    nS1: Z_STRING.nullish(),
    nS2: Z_STRING.nullish(),
    nS3: Z_STRING.nullish(),
    nS4: Z_STRING.nullish(),
    xS1: Z_STRING.nullish(),
    xS2: Z_STRING.nullish(),
    xS3: Z_STRING.nullish(),
    cS1: Z_STRING.nullish(),
    cS2: Z_STRING.nullish(),
    sS1: Z_STRING.nullish(),
    sS2: Z_STRING.nullish(),
    disability_L: Z_STRING.nullish(),
    disability_B: Z_STRING.nullish(),
    disability_D: Z_STRING.nullish(),
    disability_P: Z_STRING.nullish(),
    yob: Z_STRING,
    citizenship: Z_STRING,
    school_code: Z_STRING,
    school_Category: Z_STRING,
    selected_School: Z_STRING,
    method: Z_STRING,
    schoolAdmittedOrig: Z_PARSE_SCHOOL_ADMITTED,
    schoolAdmitted: Z_PARSE_SCHOOL_ADMITTED,
    category2: Z_STRING,
    selectionType: Z_NUMBER_STRING
});

export const Z_RESULTS = Z_RESULTS_SHAPE.partial().transform(res => ({
    name: res.name,
    gender: res.ge,
    yearOfBirth: res.yob,
    citizenship: res.citizenship,
    indexNo: res.indeX_NO,
    marks: res.tot,
    primarySchool: {
        name: res.school_Name,
        knecCode: res.school_code,
        districtName: res.district_name,
        districtCode: res.district_code
    },
    disability: {
        l: res.disability_L,
        b: res.disability_B,
        d: res.disability_D,
        p: res.disability_P
    },
    preferredSecondarySchools: {
        nationals: {
            ns1: res.nS1,
            ns2: res.nS2,
            ns3: res.nS3,
            ns4: res.nS4
        },
        extraCounty: {
            xc1: res.xS1,
            xc2: res.xS2,
            xc3: res.xS3
        },
        county: {
            cs1: res.cS1,
            cs2: res.cS2
        },
        secondary: {
            ss1: res.sS1,
            ss2: res.sS2
        }
    },
    selectedSchool: {
        category: res.school_Category,
        knecCode: res.selected_School
    },
    method: res.method,
    category: res.category2,
    schoolAdmitted: res.schoolAdmitted,
    originalSchoolAdmitted: res.schoolAdmittedOrig
}));

export const Z_ADMISSION = Z_RESULTS;

export const Z_INSTITUTION = z
    .object({
        //Institution Bio Data Tab
        name: Z_STRING,
        knecCode: Z_STRING,
        code: Z_STRING,
        gender: Z_INST_GENDER,
        supportedGrades: z.array(Z_GRADE),
        registrationNumber: Z_STRING,
        tscCode: Z_STRING,
        type: Z_INST_TYPE,
        registrationStatus: Z_INST_REGISTRATION_STATUS,
        accommodation: Z_INST_ACCOMMODATION,
        category: Z_INST_CATEGORY,
        educationLevel: Z_INST_EDUCATION_LEVEL,
        institutionMobility: Z_INST_MOBILITY,
        residence: Z_INST_RESIDENCE,
        educationSystem: Z_INST_EDUCATION_SYSTEM,
        constituency: Z_STRING,
        kraPin: Z_STRING,
        // plusCode:
        // document.querySelector("#PlusCode")?.attrs?.value?.toLowerCase()||''
        //,
        registrationDate: Z_STRING,
        ward: Z_STRING,
        zone: Z_STRING,
        county: Z_STRING,
        subCounty: Z_STRING,
        cluster: Z_STRING,
        // Ownership Details Tab
        ownership: Z_INST_OWNERSHIP,
        ownershipDocument: Z_INST_OWNERSHIP_DOCUMENT,
        owner: Z_STRING,
        incorporationCertificateNumber: Z_STRING,
        nearestPoliceStation: Z_STRING,
        nearestHealthFacility: Z_STRING,
        nearestTown: Z_STRING,
        //Institution Contacts Tab
        postalAddress: Z_STRING,
        telephoneNumber: Z_STRING,
        mobileNumber: Z_STRING,
        altTelephoneNumber: Z_STRING,
        altMobileNumber: Z_STRING,
        email: Z_STRING,
        website: Z_STRING,
        socialMediaHandles: Z_STRING
    })
    .partial()
    .required({
        name: true,
        knecCode: true,
        code: true,
        gender: true,
        supportedGrades: true,
        educationLevel: true,
        county: true,
        subCounty: true
    });

export const Z_LIST_LEARNERS = z
    .object({
        'Learner UPI': Z_STRING,
        'Learner Name': Z_STRING,
        Gender: Z_GENDER,
        'Date of Birth': Z_NEMIS_DATE,
        AGE: Z_NUMBER,
        'Birth Cert No': Z_STRING,
        Disability: z.coerce.boolean(),
        'Medical Condition': Z_STRING,
        'Home Phone': Z_STRING,
        'NHIF No': Z_STRING
    })
    .transform(learner => ({
        upi: learner['Learner UPI'],
        name: learner['Learner Name'],
        gender: learner['Gender'],
        dob: learner['Date of Birth'],
        age: learner['AGE'],
        birthCertificateNo: learner['Birth Cert No'],
        isSpecial: learner['Disability'],
        medicalCondition: learner['Medical Condition'],
        homePhone: learner['Home Phone'],
        nhifNo: learner['NHIF No']
    }));
export const Z_LIST_ADMITTED_LEARNERS = z
    .object({
        Index: Z_STRING,
        Name: Z_STRING,
        Gender: Z_STRING,
        'Year of Birth': Z_STRING,
        Marks: Z_NUMBER,
        'Sub-County': Z_STRING,
        UPI: Z_STRING,
        no: Z_NUMBER,
        postback: Z_STRING,
        actions: z.object({
            captureWithBirthCertificate: Z_STRING,
            captureWithoutBirthCertificate: Z_STRING,
            resetBiodataCapture: Z_STRING,
            undoAdmission: Z_STRING
        })
    })
    .transform(learner => {
        return {
            indexNo: learner['Index'],
            name: learner['Name'],
            gender: learner['Gender'],
            yob: learner['Year of Birth'],
            marks: learner['Marks'],
            subCounty: learner['Sub-County'],
            upi: learner['UPI'] === '&nbsp;' ? undefined : learner['UPI'],
            no: learner.no,
            postback: learner.postback,
            actions: learner.actions
        };
    });
export const Z_REQUESTED_LEARNERS = z.array(
    z
        .object({
            ['No.']: Z_NUMBER,
            ['Index No']: Z_STRING,
            ['Student Name']: Z_STRING,
            ['Gender']: Z_GENDER,
            ['Marks']: Z_NUMBER.min(0).max(500),
            ['Current Selected To']: Z_PARSE_SCHOOL_ADMITTED,
            ['Request Description']: Z_STRING,
            ["Parent's IDNo"]: Z_STRING,
            ['Mobile No']: Z_STRING,
            ['Date Captured']: Z_STRING,

            ['Approved By']: Z_STRING,
            ['Approved On']: Z_NEMIS_DATE,

            ['Status']: Z_STRING,
            [13]: Z_STRING.transform(val => val.match(/ctl.*?Del/gi)?.pop())
        })
        .partial()
        .transform(learner => ({
            no: learner['No.'],
            indexNo: learner['Index No'],
            name: learner['Student Name'],
            gender: learner['Gender'],
            marks: learner['Marks'],
            schoolSelected: learner['Current Selected To'],
            requestedBy: learner['Request Description'],
            parentId: learner["Parent's IDNo"],
            parentTel: learner['Mobile No'],
            dateCaptured: learner['Date Captured'],
            approved: {
                by: learner['Approved By']?.replaceAll('&nbsp;', ''),
                on: learner['Approved On']
            },
            status: learner['Status']?.replaceAll('&nbsp;', ''),
            deleteCallback: learner[13]
        }))
);
export const Z_SELECTED_LEARNER = z.array(
    z
        .object({
            ['Index']: Z_STRING,
            ['Name']: Z_STRING,
            ['Gender']: Z_GENDER,
            ['Year of Birth']: Z_NUMBER,
            ['Marks']: Z_NUMBER.min(0).max(500),
            ['Sub-County']: Z_STRING
        })
        .transform(learner => ({
            indexNo: learner.Index,
            name: learner.Name,
            gender: learner.Gender,
            yearOfBirth: learner['Year of Birth'],
            marks: learner.Marks,
            subCounty: learner['Sub-County']
        }))
);
