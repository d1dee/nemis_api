/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { z } from "zod";
import { gradesSchema } from "@libs/zod_validation";
import { utcToZonedTime } from "date-fns-tz";

export const NEMIS_DATE_SCHEMA = z.date().pipe(
    z.string().transform(x => {
        let dob = x.split('-');
        return utcToZonedTime([dob[1], dob[0], dob[2]].join('-'), 'Africa/Nairobi');
    })
);
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
export const INSTITUTION_MOBILITY_TYPE = ['Static', 'Mobile'] as const;
export const INSTITUTION_ACCOMMODATION_TYPE = ['Day', 'Boarding', 'Daya and Boarding'] as const;
export const INSTITUTION_RESIDENCE = ['Rural', 'Urban'] as const;
export const EDUCATION_SYSTEM = ['8.4.4/CBC', 'IGSCE', 'Both', 'TVET'] as const;
export const INSTITUTION_GENDER = ['Boys', 'Girls', 'Mixed'] as const;
let supportedGradesSchema = z
    .array(
        z
            .object({
                class_Name: z.string().trim().toLowerCase()
            })
            .transform(x => x.class_Name)
    )
    .pipe(gradesSchema.array());

export const institutionSchema = z.object({
    //Institution Bio Data Tab
    name: z.coerce.string().toLowerCase().trim(),
    knecCode: z.coerce.string().toLowerCase().trim(),
    code: z.coerce.string().toLowerCase().trim(),
    gender: z.string().trim().pipe(z.enum(INSTITUTION_GENDER)),
    supportedGrades: supportedGradesSchema,
    registrationNumber: z.coerce.string().toLowerCase().trim(),
    tscCode: z.coerce.string().toLowerCase().trim(),
    type: z.string().trim().pipe(z.enum(INSTITUTION_TYPE)),
    registrationStatus: z.string().trim().pipe(z.enum(INSTITUTION_REGISTRATION_STATUS)),
    accommodation: z.string().trim().pipe(z.enum(INSTITUTION_ACCOMMODATION_TYPE)),
    category: z.string().trim().pipe(z.enum(INSTITUTION_CATEGORY)),
    educationLevel: z
        .string()
        .trim()
        .pipe(z.enum(INSTITUTION_LEVEL))
        .transform(level => {
            return {
                description: level,
                code: INSTITUTION_LEVEL.findIndex(x => level === x) + 1
            };
        }),
    institutionMobility: z.string().trim().pipe(z.enum(INSTITUTION_MOBILITY_TYPE)),
    residence: z.string().trim().pipe(z.enum(INSTITUTION_RESIDENCE)),
    educationSystem: z.string().trim().pipe(z.enum(EDUCATION_SYSTEM)),
    constituency: z.coerce.string().toLowerCase().trim(),
    kraPin: z.coerce.string().toLowerCase().trim(),
    // plusCode:
    // document.querySelector("#PlusCode")?.attrs?.value?.toLowerCase()||''
    //,
    registrationDate: z.coerce.string().toLowerCase().trim(),
    ward: z.coerce.string().toLowerCase().trim(),
    zone: z.coerce.string().toLowerCase().trim(),
    county: z.coerce.string().toLowerCase().trim(),
    subCounty: z.coerce.string().toLowerCase().trim(),
    cluster: z.coerce.string().toLowerCase().trim(),
    // Ownership Details Tab
    ownership: z.string().trim().pipe(z.enum(INSTITUTION_OWNER_TYPE)),
    ownershipDocument: z.string().trim().pipe(z.enum(OWNERSHIP_DOCUMENT_TYPE)),
    owner: z.coerce.string().toLowerCase().trim(),
    incorporationCertificateNumber: z.coerce.string().toLowerCase().trim(),
    nearestPoliceStation: z.coerce.string().toLowerCase().trim(),
    nearestHealthFacility: z.coerce.string().toLowerCase().trim(),
    nearestTown: z.coerce.string().toLowerCase().trim(),
    //Institution Contacts Tab
    postalAddress: z.coerce.string().toLowerCase().trim(),
    telephoneNumber: z.coerce.string().toLowerCase().trim(),
    mobileNumber: z.coerce.string().toLowerCase().trim(),
    altTelephoneNumber: z.coerce.string().toLowerCase().trim(),
    altMobileNumber: z.coerce.string().toLowerCase().trim(),
    email: z.coerce.string().toLowerCase().trim(),
    website: z.coerce.string().toLowerCase().trim(),
    socialMediaHandles: z.coerce.string().toLowerCase().trim()
});
