/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { z as zod } from "zod";
import { countyToNo } from "./converts";
import institution from "@database/institution";

const usernamePasswordSchema = zod.object({
    username: zod
        .string({
            required_error:
                'Username is required. Note it should be the same as the username used to login to NEMIS website',
            invalid_type_error: 'Username must be of type string'
        })
        .trim()
        .min(4, 'Username too short'),
    password: zod
        .string({
            required_error:
                'Password is required. Note it should be the same as the password used to login to NEMIS website',
            invalid_type_error: 'Password must be of type string.'
        })
        .min(1, 'Password can not be blank.')
});

const newInstitutionSchema = usernamePasswordSchema.transform(async (x, ctx) => {
    let isRegistered = await institution.findOne({ username: { $eq: x.username } });
    // If not archived we need to refresh token not register.
    if (!isRegistered || isRegistered?.isArchived)
        return { ...x, previousRegistration: isRegistered };
    else {
        ctx.addIssue({
            code: zod.ZodIssueCode.custom,
            message: 'Username ' + x.username + ' is already registered.',
            path: ['username']
        });
        return zod.NEVER;
    }
});

const GRADES = [
    'form 1',
    'form 2',
    'form 3',
    'form 4',
    'pp 1',
    'pp 2',
    'grade 1',
    'grade 2',
    'grade 3',
    'grade 4',
    'grade 5',
    'grade 6',
    'grade 7',
    'grade 8',
    'grade 9',
    'grade 10',
    'grade 11'
] as const;

const MEDICAL_CONDITIONS = [
    'anemia',
    'asthma',
    'convulsions',
    'diabetes',
    'epilepsy',
    'none'
] as const;

const NATIONALITY = [
    'kenya',
    'sudan',
    'tanzania',
    'somalia',
    'ethiopia',
    'europe | america',
    'africa',
    'others'
] as const;

let phoneNumberSchema = zod.coerce
    .string()
    .trim()
    .refine(
        value => {
            // Check if the phone number is a Kenyan phone number
            if (/^0([71])[0-9]{7,8}$/.test(value)) {
                return true;
            }
            // Check if the phone number is an international phone number
            if (/^\+(?:[0-9] ?){6,14}[0-9]$/.test(value)) {
                return true;
            }
            // The phone number is not valid
            return false;
        },
        {
            message: 'Invalid phone number'
        }
    );
let medicalConditionSchema = zod
    .union([zod.enum(MEDICAL_CONDITIONS), zod.undefined()])
    .default('none');

let fullNameSchema = zod.coerce
    .string()
    .trim()
    .regex(
        // Check if the name has more than two spaces to be considered as a full name
        /^[a-zA-Z\W]+(?:\s[a-zA-Z\W]+)+$/,
        'At least two names were expected but only one name was received.'
    );
// Nemis returns an error if ID number is less than 8
let idSchema = zod.union([
    zod.undefined(),
    zod.coerce
        .string()
        .trim()
        .transform(x => x.padStart(8, '0'))
]);

let gradesSchema = zod.enum(GRADES);

let genderSchema = zod.enum(['m', 'f']);

let nationalitiesSchema = zod.enum(NATIONALITY).default('kenya');

let contactSchema = zod.union([
    zod.object({
        name: fullNameSchema.trim().optional(),
        tel: phoneNumberSchema.optional(),
        id: zod.union([zod.undefined(), idSchema])
    }),
    zod.undefined()
]);

let completeLearnerSchema = zod.object({
    adm: zod.coerce
        .string()
        .trim()
        .refine(val => val !== 'undefined', 'Adm number can not be' + ' empty or undefined'),
    name: fullNameSchema.trim(),
    dob: zod.coerce
        .date({
            invalid_type_error:
                'Invalidate dae was provided, make sure date of birth is in the format "YYYY/MM/DD"'
        })
        .optional(),
    grade: gradesSchema,
    stream: zod.string().trim().optional(),
    upi: zod.string().trim().min(4).optional(),
    gender: genderSchema,
    father: contactSchema,
    mother: contactSchema,
    guardian: contactSchema,
    address: zod.union([zod.undefined(), zod.coerce.string().trim()]),
    county: zod.union([
        zod.undefined(),
        zod
            .string()
            .trim()
            .refine(
                value => countyToNo(value),
                value => ({ message: `${value} is not a valid county name` })
            )
    ]),
    subCounty: zod.string().trim().optional(),
    birthCertificateNo: zod.union([zod.undefined(), zod.coerce.string().trim()]),
    medicalCondition: medicalConditionSchema,
    isSpecial: zod.boolean().default(false),
    marks: zod.union([zod.undefined(), zod.coerce.number().min(0).max(500)]),
    indexNo: zod.union([
        zod.undefined(),
        zod.coerce
            .string()
            .trim()
            .length(
                11,
                'Index number should be 11 characters' +
                    ' long, if index number starts with a zero (0), make sure it is included.'
            )
    ]),
    nationality: nationalitiesSchema,
    continuing: zod.boolean().default(false),
    kcpeYear: zod.coerce.number(zod.string().min(4)).optional().default(new Date().getFullYear())
});

const uniqueIdentifierSchema = zod.string({
    required_error:
        'Unique identifier missing.To delete a learner, a unique identifier must be provided. The identifier can be either the UPI, birth certificate number, or admission number.',
    invalid_type_error: ' Unique identifier must be of type string.'
});

export {
    NATIONALITY,
    MEDICAL_CONDITIONS,
    GRADES,
    gradesSchema,
    genderSchema,
    nationalitiesSchema,
    fullNameSchema,
    completeLearnerSchema,
    phoneNumberSchema,
    medicalConditionSchema,
    usernamePasswordSchema,
    newInstitutionSchema,
    uniqueIdentifierSchema
};
