/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { z } from "zod";
import { utcToZonedTime } from "date-fns-tz";

export const Z_NEMIS_DATE = z.date().pipe(
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
