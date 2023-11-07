/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { z } from "zod";
import { genderSchema, gradesSchema } from "@libs/zod_validation";
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
export const GENDER_SCHEMA = genderSchema.pipe(
    z
        .string()
        .toLowerCase()
        .transform(gender => (gender.startsWith('m') ? 'male' : 'female'))
);
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
