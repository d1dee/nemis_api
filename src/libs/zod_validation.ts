/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { z as zod } from 'zod';
import { countyToNo } from './converts';
import institution from '../database/institution';

const usernamePasswordSchema = zod.object({
	username: zod.string({
		required_error: 'Username is required. Note it should be the same as the username used to login to NEMIS website',
		invalid_type_error: 'Username must be of type string'
	}).trim().min(4, 'Username too short'),
	password: zod.string({
		required_error: 'Password is required. Note it should be the same as the password used to login to NEMIS website',
		invalid_type_error: 'Password must be of type string.'
	}).min(1, 'Password can not be blank.')
});
const newInstitutionSchema = usernamePasswordSchema.transform(async (x, ctx) => {
	let isRegistered = await institution.findOne({ username: x.username });
	// If not archived we need to refresh token not register.
	if (!isRegistered || isRegistered?.isArchived) return { ...x, _id: isRegistered?._id };
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
	'form 1', 'form 2', 'form 3', 'form 4', 'pp 1', 'pp 2', 'grade 1',
	'grade 2', 'grade 3', 'grade 4', 'grade 5', 'grade 6', 'grade 7',
	'grade 8', 'grade 9', 'grade 10', 'grade 11'
] as const;

const MEDICAL_CONDITIONS = [
	'anemia', 'asthma', 'convulsions', 'diabetes', 'epilepsy', 'none'
] as const;

const NATIONALITY = [
	'kenya', 'sudan', 'tanzania', 'somalia', 'ethiopia', 'europe | america',
	'africa', 'others'
] as const;

let phoneNumberSchema = zod.coerce.string().trim().refine(
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

let fullNameSchema = zod.coerce.string().trim().regex(
	// Check if the name has more than two spaces to be considered as a full name
	/^[a-zA-Z\W]+(?:\s[a-zA-Z\W]+)+$/,
	'At least two names were expected but only one name was received.'
);
// Nemis returns an error if ID number is less than 8
let idSchema = zod.union([zod.undefined(), zod.coerce.string().trim()
	.transform(x => x.padStart(8, '0'))]);

let gradesSchema = zod.enum(GRADES);

let genderSchema = zod.enum(['m', 'f']);

let nationalitiesSchema = zod.enum(NATIONALITY).default('kenya');

let contactSchema = zod.union([zod.object({
	name: fullNameSchema.trim().optional(),
	tel: phoneNumberSchema.optional(),
	id: zod.union([zod.undefined(), idSchema])
}), zod.undefined()]);

let completeLearnerSchema = zod.object({
	adm: zod.coerce
		.string().trim()
		.refine(val => val !== 'undefined', 'Adm number can not be' + ' empty or undefined'),
	name: fullNameSchema.trim(),
	dob: zod.coerce.date({
		required_error: 'Learner\'s date of birth is required',
		invalid_type_error: 'Invalidate dae was provided, make sure date of birth is in the format "YYYY/MM/DD"'
	}),
	grade: gradesSchema,
	stream: zod.string().trim().optional(),
	upi: zod.string().trim().min(4).optional(),
	gender: genderSchema,
	father: contactSchema,
	mother: contactSchema,
	guardian: contactSchema,
	address: zod.union([zod.undefined(), zod.coerce.string().trim()]),
	county: zod.union([zod.undefined(), zod.string().trim().refine(
		value => countyToNo(value),
		value => ({ message: `${value} is not a valid county name` })
	)]),
	subCounty: zod.string().trim().optional(),
	birthCertificateNo: zod.union([zod.undefined(), zod.coerce.string().trim()]),
	medicalCondition: medicalConditionSchema,
	isSpecial: zod.boolean().default(false),
	marks: zod.union([zod.undefined(), zod.coerce.number().min(0).max(500)]),
	indexNo: zod.union([zod.undefined(), zod.coerce
		.string().trim()
		.length(
			11,
			'Index number should be 11 characters' +
			' long, if index number starts with a zero (0), make sure it is included.'
		)]),
	nationality: nationalitiesSchema,
	continuing: zod.boolean().default(false),
	kcpeYear: zod.number().optional().default(new Date().getFullYear())
});

let requestingJoiningLearnerSchema = zod
	.object({
		indexNo: zod.string().trim().length(11, 'Index number must be 11 characters long.'),
		parentTel: phoneNumberSchema,
		parentId: zod.string().trim(),
		adm: zod.string().trim(),
		requestedBy: zod.string().trim().optional()
	})
	.transform(x => {
		return {
			indexNo: x.indexNo,
			parent: {
				tel: x.parentTel,
				id: x.parentId
			},
			adm: x.adm,
			requestedBy: x.requestedBy
		};
	});

const listLearnerSchema = zod.object({
	'Learner UPI': zod.string().trim().toLowerCase(),
	'Learner Name': zod.string().trim().toLowerCase(),
	'Gender': zod.string().trim().toLowerCase(),
	'Date of Birth': /*zod.coerce.date(*/zod.string().transform(x => {
		let s = x.split('-');
		return [s[1], s[0], s[2]].join('-');
	}),
	'AGE': zod.coerce.number(),
	'Birth Cert No': zod.string().trim().toLowerCase(),
	'Disability': zod.coerce.boolean(),
	'Medical Condition': zod.string().trim().toLowerCase(),
	'Home Phone': zod.string().trim().toLowerCase(),
	'NHIF No': zod.coerce.number()
}).transform(x => ({
	upi: x['Learner UPI'],
	name: x['Learner Name'],
	gender: x['Gender'],
	dob: x['Date of Birth'],//new Date(.setDate(x["Date of Birth"].getDate() + 1)),
	age: x['AGE'],
	birthCertificateNo: x['Birth Cert No'],
	isSpecial: x['Disability'],
	medicalCondition: x['Medical Condition'],
	homePhone: x['Home Phone'],
	nhifNo: x['NHIF No']

}));

const listAdmittedLearnerSchema = zod.object({
	'Index': zod.coerce.string().trim().toLowerCase().optional(),
	'Name': zod.coerce.string().trim().toLowerCase().optional(),
	'Gender': zod.coerce.string().trim().toLowerCase().optional(),
	'Year of Birth': zod.coerce.string().trim().toLowerCase().optional(),
	'Marks': zod.coerce.number(zod.coerce.string().trim().toLowerCase()).optional(),
	'Sub-County': zod.coerce.string().trim().toLowerCase().optional(),
	'UPI': zod.union([zod.undefined(), zod.coerce.string().trim().toLowerCase()]).optional(),
	no: zod.number().optional(),
	postback: zod.coerce.string().optional(),
	actions: zod.object({
		captureWithBirthCertificate: zod.coerce.string().optional(),
		captureWithoutBirthCertificate: zod.coerce.string().optional(),
		resetBiodataCapture: zod.coerce.string().optional(),
		undoAdmission: zod.coerce.string().optional()
	})
}).transform(x => {
	return {
		indexNo: String(x['Index']),
		name: String(x['Name']),
		gender: String(x['Gender']),
		yob: Number(x['Year of Birth']),
		marks: Number(x['Marks']),
		subCounty: String(x['Sub-County']),
		upi: x['UPI'] === '&nbsp;' ? undefined : String(x['UPI']),
		no: x.no,
		postback: x.postback,
		actions: x.actions
	};
});

const INSTITUTION_OWNER_TYPE = ['GOK', 'Mission', 'Private'] as const;
const OWNERSHIP_DOCUMENT_TYPE = ['Lease', 'Title Deed', 'Agreement'] as const;
const INSTITUTION_TYPE = ['Public', 'Private'] as const;
const INSTITUTION_REGISTRATION_STATUS = ['Registered', 'Re-Registered', 'Suspended'] as const;
const INSTITUTION_CATEGORY = ['Integrated', 'Regular', 'Regular with Special Unit', 'Special School'] as const;
const INSTITUTION_LEVEL = ['ECDE', 'Primary', 'Secondary', 'TTC', 'TVET', 'JSS', 'A-Level', 'Pre-vocational'] as const;
const INSTITUTION_MOBILITY_TYPE = ['Static', 'Mobile'] as const;
const INSTITUTION_ACCOMMODATION_TYPE = ['Day', 'Boarding', 'Daya and Boarding'] as const;
const INSTITUTION_RESIDENCE = ['Rural', 'Urban'] as const;
const EDUCATION_SYSTEM = ['8.4.4/CBC', 'IGSCE', 'Both', 'TVET'] as const;
const INSTITUTION_GENDER = ['Boys', 'Girls', 'Mixed'] as const;
let supportedGradesSchema = zod.array(zod.object({
	'class_Name': zod.string().trim().toLowerCase()
}).transform(x => x.class_Name)).pipe(gradesSchema.array());

const institutionSchema = zod.object({
	//Institution Bio Data Tab
	name: zod.coerce.string().toLowerCase().trim(),
	knecCode: zod.coerce.string().toLowerCase().trim(),
	code: zod.coerce.string().toLowerCase().trim(),
	gender: zod.string().trim().pipe(zod.enum(INSTITUTION_GENDER)),
	supportedGrades: supportedGradesSchema,
	registrationNumber: zod.coerce.string().toLowerCase().trim(),
	tscCode: zod.coerce.string().toLowerCase().trim(),
	type: zod.string().trim().pipe(zod.enum(INSTITUTION_TYPE)),
	registrationStatus: zod.string().trim().pipe(zod.enum(INSTITUTION_REGISTRATION_STATUS)),
	accommodation: zod.string().trim().pipe(zod.enum(INSTITUTION_ACCOMMODATION_TYPE)),
	category: zod.string().trim().pipe(zod.enum(INSTITUTION_CATEGORY)),
	educationLevel: zod.string().trim().pipe(zod.enum(INSTITUTION_LEVEL)),
	institutionMobility: zod.string().trim().pipe(zod.enum(INSTITUTION_MOBILITY_TYPE)),
	residence: zod.string().trim().pipe(zod.enum(INSTITUTION_RESIDENCE)),
	educationSystem: zod.string().trim().pipe(zod.enum(EDUCATION_SYSTEM)),
	constituency: zod.coerce.string().toLowerCase().trim(),
	kraPin: zod.coerce.string().toLowerCase().trim(),
	// plusCode:
	// document.querySelector("#PlusCode")?.attrs?.value?.toLowerCase()||''
	//,
	registrationDate: zod.coerce.string().toLowerCase().trim(),
	ward: zod.coerce.string().toLowerCase().trim(),
	zone: zod.coerce.string().toLowerCase().trim(),
	county: zod.coerce.string().toLowerCase().trim(),
	subCounty: zod.coerce.string().toLowerCase().trim(),
	cluster: zod.coerce.string().toLowerCase().trim(),
	// Ownership Details Tab
	ownership: zod.string().trim().pipe(zod.enum(INSTITUTION_OWNER_TYPE)),
	ownershipDocument: zod.string().trim().pipe(zod.enum(OWNERSHIP_DOCUMENT_TYPE)),
	owner: zod.coerce.string().toLowerCase().trim(),
	incorporationCertificateNumber: zod.coerce.string().toLowerCase().trim(),
	nearestPoliceStation: zod.coerce.string().toLowerCase().trim(),
	nearestHealthFacility: zod.coerce.string().toLowerCase().trim(),
	nearestTown: zod.coerce.string().toLowerCase().trim(),
	//Institution Contacts Tab
	postalAddress: zod.coerce.string().toLowerCase().trim(),
	telephoneNumber: zod.coerce.string().toLowerCase().trim(),
	mobileNumber: zod.coerce.string().toLowerCase().trim(),
	altTelephoneNumber: zod.coerce.string().toLowerCase().trim(),
	altMobileNumber: zod.coerce.string().toLowerCase().trim(),
	email: zod.coerce.string().toLowerCase().trim(),
	website: zod.coerce.string().toLowerCase().trim(),
	socialMediaHandles: zod.coerce.string().toLowerCase().trim()
});

const uniqueIdentifierSchema = zod
	.string({
		required_error:
			'Unique identifier missing.To delete a learner, a unique identifier must be provided. The identifier can be either the UPI, birth certificate number, or admission number.',
		invalid_type_error: ' Unique identifier must be of type string.'
	});

export {
	gradesSchema, genderSchema, nationalitiesSchema, zod, fullNameSchema,
	completeLearnerSchema, requestingJoiningLearnerSchema, phoneNumberSchema,
	medicalConditionSchema, listLearnerSchema, listAdmittedLearnerSchema,
	institutionSchema, usernamePasswordSchema, newInstitutionSchema, uniqueIdentifierSchema,
	NATIONALITY, MEDICAL_CONDITIONS, GRADES, INSTITUTION_OWNER_TYPE,
	OWNERSHIP_DOCUMENT_TYPE, INSTITUTION_TYPE, INSTITUTION_REGISTRATION_STATUS,
	INSTITUTION_CATEGORY, INSTITUTION_LEVEL, INSTITUTION_MOBILITY_TYPE,
	INSTITUTION_ACCOMMODATION_TYPE, INSTITUTION_RESIDENCE, EDUCATION_SYSTEM, INSTITUTION_GENDER
};
