/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { z } from "zod";
import { countyToNo, dateTime } from "./converts";
import institution from "@database/institution";

const usernamePasswordSchema = z.object({
    username: z
        .string({
            required_error:
                'Username is required. Note it should be the same as the username used to login to NEMIS website',
            invalid_type_error: 'Username must be of type string'
        })
        .trim()
        .min(4, 'Username too short'),
    password: z
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
            code: z.ZodIssueCode.custom,
            message: 'Username ' + x.username + ' is already registered.',
            path: ['username']
        });
        return z.NEVER;
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

const GENDER = ['male', 'female'] as const;

let phoneNumberSchema = z.coerce
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
let medicalConditionSchema = z.union([z.enum(MEDICAL_CONDITIONS), z.undefined()]).default('none');

let fullNameSchema = z.coerce
    .string()
    .trim()
    .regex(
        // Check if the name has more than two spaces to be considered as a full name
        /^[a-zA-Z\W]+(?:\s[a-zA-Z\W]+)+$/,
        'At least two names were expected but only one name was received.'
    );
// Nemis returns an error if ID number is less than 8
let idSchema = z.union([
    z.undefined(),
    z.coerce
        .string()
        .trim()
        .transform(x => x.padStart(8, '0'))
]);

let gradesSchema = z.enum(GRADES);

let genderSchema = z.enum(GENDER);

let nationalitiesSchema = z.enum(NATIONALITY).default('kenya');

let contactSchema = z.union([
    z.object({
        name: fullNameSchema.trim().optional(),
        tel: phoneNumberSchema.optional(),
        id: z.union([z.undefined(), idSchema])
    }),
    z.undefined()
]);

let completeLearnerSchema = z.object({
    adm: z.coerce
        .string()
        .trim()
        .refine(val => val !== 'undefined', 'Adm number can not be' + ' empty or undefined'),
    name: fullNameSchema.trim(),
    dob: z.coerce
        .date({
            invalid_type_error:
                'Invalidate date was provided, make sure date of birth is in the format "YYYY/MM/DD"'
        })
        .transform(date => dateTime(date)),
    grade: gradesSchema,
    stream: z.string().trim().optional(),
    upi: z.string().trim().min(4).optional(),
    gender: z.string().transform((value, ctx) => {
        switch (value) {
            case 'male' || 'female':
                break;
            case 'm':
                value = 'male';
                break;
            case 'f':
                value = 'female';
                break;
            default:
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `${value} is not a valid gender representation. Gender should be either male or female.`
                });
        }
        return value;
    }),
    father: contactSchema,
    mother: contactSchema,
    guardian: contactSchema,
    address: z.union([z.undefined(), z.coerce.string().trim()]),
    county: z.union([
        z.undefined(),
        z
            .string()
            .trim()
            .refine(
                value => countyToNo(value),
                value => ({ message: `${value} is not a valid county name` })
            )
    ]),
    subCounty: z.string().trim().optional(),
    birthCertificateNo: z.union([z.undefined(), z.coerce.string().trim()]),
    medicalCondition: medicalConditionSchema,
    isSpecial: z.boolean().default(false),
    marks: z.union([z.undefined(), z.coerce.number().min(0).max(500)]),
    indexNo: z.union([
        z.undefined(),
        z.coerce
            .string()
            .trim()
            .length(
                11,
                'Index number should be 11 characters' +
                    ' long, if index number starts with a zero (0), make sure it is included.'
            )
    ]),
    nationality: nationalitiesSchema,
    continuing: z.boolean().default(false),
    kcpeYear: z.coerce.number(z.string().min(4)).optional().default(new Date().getFullYear())
});

const uniqueIdentifierSchema = z.string({
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
