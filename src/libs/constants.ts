/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { z } from 'zod';
import { dateTime } from '@libs/converts';

export const GRADES = [
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

export const MEDICAL_CONDITIONS = [
    'anemia',
    'asthma',
    'convulsions',
    'diabetes',
    'epilepsy',
    'none'
] as const;

export const NATIONALITY = [
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

export const Z_STRING = z.string().trim();
export const Z_NUMBER = z.coerce.number();
export const Z_GENDER = Z_STRING.transform(gender =>
    /m/i.test(gender.charAt(0)) ? 'male' : /f/i.test(gender.charAt(0)) ? 'female' : undefined
).pipe(z.enum(GENDER));
export const Z_NUMBER_STRING = z.union([
    Z_STRING,
    Z_NUMBER.pipe(z.coerce.string().min(1, 'Birth certificate number can not be an empty string.'))
]);
export const Z_GRADE = Z_STRING.pipe(z.enum(GRADES));
export const Z_PHONE_NUMBER = Z_NUMBER_STRING.transform(val =>
    val.length === 9 && val.startsWith('7') ? val.padStart(10, '0') : val
).refine(val => /^0([712])[0-9]{7,8}$/.test(val) || /^\+(?:[0-9] ?){6,14}[0-9]$/.test(val), {
    message: 'Invalid phone number'
});
export const Z_NAMES = Z_STRING.regex(
    // Check if the name has more than two spaces to be considered as a full name
    /^[a-zA-Z\W]+(?:\s[a-zA-Z\W]+)+$/,
    'At least two names were expected but only one name was received.'
);
export const Z_DATE_TIME = z.coerce
    .date({
        invalid_type_error: 'Invalid date was provided, make sure date of birth is in the format "YYYY/MM/DD"'
    })
    .transform(date => dateTime(date));
export const Z_ID = Z_NUMBER_STRING.transform(x => x.padStart(8, '0'));
export const Z_MEDICAL_CONDITION = Z_STRING.pipe(z.enum(MEDICAL_CONDITIONS).nullish());
export const Z_INDEX_NUMBER = Z_NUMBER_STRING.pipe(
    Z_STRING.length(
        11,
        'Index number should be 11 characters long, if index number starts with a zero (0), make sure it is included.'
    )
);
export const Z_TRANSFER_METHOD = Z_STRING.pipe(z.enum(['in', 'out']));
export const Z_NATIONALITIES = Z_STRING.default('kenya').pipe(z.enum(NATIONALITY));
export const Z_STRING_TO_BOOLEAN = Z_STRING.transform(arg => arg === 'true');
export const Z_CONTACTS = z.object({
    name: Z_STRING,
    tel: Z_STRING,
    id: Z_STRING
});

export const Z_PARSE_SCHOOL_ADMITTED = Z_STRING.transform(val => {
    let valArray = val.toLowerCase().split(' ');
    let typeIndex = valArray.findIndex(val => val.startsWith('type'));
    let categoryIndex = valArray.findIndex(val => val.startsWith('category'));
    return {
        originalString: val,
        code: valArray[0],
        name: valArray.slice(1, typeIndex - 1).join(' '),
        type: valArray.slice(typeIndex, categoryIndex).join(' ').replace('type:', ''),
        category: valArray.splice(categoryIndex).join(' ').replace('category:', '')
    };
});
export const LEARNER_FIELDS = [
    'name',
    'adm',
    'grade',
    'dob',
    'stream',
    'upi',
    'gender',
    'subCounty',
    'birthCertificateNo',
    'medicalCondition',
    'isSpecial',
    'marks',
    'indexNo',
    'nationality',
    'continuing',
    'kcpeYear'
] as const;
