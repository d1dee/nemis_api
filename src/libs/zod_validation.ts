/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {z as zod} from 'zod';
import {countyToNo} from './converts';

let GRADES = [
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

let phoneNumberSchema = zod.coerce.string().refine(
	value => {
		// Check if the phone number is a Kenyan phone number
		if (/^07[0-9]{8}$/.test(value)) {
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
let fullNameSchema = zod.coerce.string().regex(
	// Check if name has more than two spaces to be considered as a full name
	/^[a-zA-Z\W]+(?:\s[a-zA-Z\W]+)+$/,
	'At least two names were expected but only one name was received.'
);

let essentialLearnerSchema = zod.object({
	adm: zod.coerce
		.string()
		.refine(val => val !== 'undefined', 'Adm number can not be' + ' empty or undefined'),
	name: fullNameSchema,
	grade: zod.enum(GRADES),
	stream: zod.string().optional(),
	upi: zod.string().min(4).optional(),
	gender: zod.enum(['m', 'f']),
	fatherName: fullNameSchema.optional(),
	fatherId: zod.string().optional(),
	fatherTel: phoneNumberSchema.optional(),
	motherName: fullNameSchema.optional(),
	motherId: zod.string().optional(),
	motherTel: phoneNumberSchema.optional(),
	guardianName: fullNameSchema.optional(),
	guardianId: zod.string().optional(),
	guardianTel: phoneNumberSchema.optional(),
	address: zod.string().optional(),
	county: zod.string().refine(
		value => countyToNo(value),
		value => ({ message: `${value} is not a valid county name` })
	),
	subCounty: zod.string().optional(),
	birthCertificateNo: zod.coerce.string().optional(),
	medicalCondition: medicalConditionSchema,
	isSpecial: zod.boolean().default(false),
	marks: zod.number().min(0).max(500).optional(),
	indexNo: zod.coerce
		.string()
		.length(
			11,
			'Index number should be 11 characters' +
				' long, if index number starts with a zero (0), make sure it is included.'
		)
		.nullable(),
	nationality: zod.union([zod.enum(NATIONALITY), zod.undefined()]).default('kenya'),
	continuing: zod.boolean().default(false),
	kcpeYear: zod.number().optional().default(new Date().getFullYear())
});

export {
	zod,
	fullNameSchema,
	essentialLearnerSchema,
	phoneNumberSchema,
	NATIONALITY,
	GRADES,
	MEDICAL_CONDITIONS,
	medicalConditionSchema
};
