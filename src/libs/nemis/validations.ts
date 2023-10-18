/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { z as zod } from 'zod';
import { medicalConditionDesc, nationalities } from '@libs/converts';
import CustomError from '@libs/error_handler';
import { gradesSchema, phoneNumberSchema } from '@libs/zod_validation';

let searchLearnerSchema = zod
	.object({
		xcat: zod.string().nullable().optional(),
		xcatdesc: zod.string().nullable().optional(),
		upi: zod.string().nullable().optional(),
		names: zod.coerce.string().transform(x => x.replaceAll(',', '')),
		surname: zod.string().nullable().optional(),
		firstname: zod.string().nullable().optional(),
		othernames: zod.string().nullable().optional(),
		institution_name: zod.string().nullable().optional(),
		phone_number: zod.string().nullable().optional(),
		email_address: zod.string().nullable().optional(),
		postal_address: zod.string().nullable().optional(),
		father_upi: zod.string().nullable().optional(),
		mother_upi: zod.string().nullable().optional(),
		guardian_upi: zod.string().nullable().optional(),
		father_name: zod.string().nullable().optional(),
		father_idno: zod.string().nullable().optional(),
		father_contacts: zod.string().nullable().optional(),
		mother_name: zod.string().nullable().optional(),
		mother_idno: zod.string().nullable().optional(),
		mother_contacts: zod.string().nullable().optional(),
		guardian_contacts: zod.string().nullable().optional(),
		guardian_idno: zod.string().nullable().optional(),
		guardian_name: zod.string().nullable().optional(),
		special_medical_condition: zod.string().nullable().optional(),
		any_special_medical_condition: zod.string().nullable().optional(),
		institution_code: zod.string().nullable().optional(),
		sub_county_code: zod.string().nullable().optional(),
		nationality: zod.string().nullable().optional(),
		gender: zod.string().nullable().optional(),
		lgender: zod.string().nullable().optional(),
		dob2: zod.string().nullable().optional(),
		birth_cert_no: zod.string().nullable().optional(),
		id_no: zod.string().nullable().optional(),
		disability_code: zod.string().nullable().optional(),
		class_code: zod.string().nullable().optional(),
		county_code: zod.string().nullable().optional(),
		county_learner: zod.string().nullable().optional(),
		sub_county_learner: zod.string().nullable().optional(),
		special_needs_list: zod.string().nullable().optional(),
		father_email: zod.string().nullable().optional(),
		mother_email: zod.string().nullable().optional(),
		guardian_email: zod.string().nullable().optional(),
		institution_type: zod.string().nullable().optional(),
		institution_level_code: zod.string().nullable().optional(),
		nhif_no: zod.string().nullable().optional(),
		class_name: zod.string().nullable().optional(),
		level_name: zod.string().nullable().optional()
	})
	.transform(res => ({
		name: res.names,
		dob: res.dob2,
		gender: res.gender || res.lgender,
		grade: res.class_name,
		upi: res.upi,
		phoneNumber: res.phone_number,
		email: res.email_address,
		address: res.postal_address,
		birthCertificateNo: res.birth_cert_no,
		nhifNo: res.nhif_no,
		learnerCategory: {
			code: res.xcat,
			description: res.xcatdesc
		},
		currentInstitution: {
			name: res.institution_name,
			code: res.institution_code,
			type: res.institution_type,
			level: res.institution_level_code
		},
		father: {
			upi: res.father_upi,
			name: res.father_name,
			email: res.father_email,
			tel: res.father_contacts,
			id: res.father_idno
		},
		mother: {
			upi: res.mother_upi,
			name: res.mother_name,
			email: res.mother_email,
			tel: res.mother_contacts,
			id: res.mother_idno
		},
		guardian: {
			upi: res.guardian_upi,
			name: res.guardian_name,
			email: res.guardian_email,
			tel: res.guardian_contacts,
			id: res.guardian_idno
		},
		medicalCondition: {
			code: Number(res?.special_medical_condition || 0),
			description: medicalConditionDesc(Number(res?.special_medical_condition || 0))
		},
		otherSpecialConditions: res.any_special_medical_condition,
		countyCode: res.county_code,
		subCountyCode: res.sub_county_learner,
		nationality: nationalities(Number(res.nationality) || 0),
		disabilityCode: res.disability_code,
		idNo: res.id_no,
		specialNeeds: res.special_needs_list
	}));

// We expect an instance of CustomError class, but we'll zod.any() to catch anything and avoid zod.parse from failing
const apiError = zod.instanceof(CustomError);

const resultsSchema = zod
	.object({
		index_no: zod.string().toLowerCase().trim(),
		ge: zod
			.string(zod.enum(['m', 'f']))
			.toLowerCase()
			.trim(),
		name: zod.string().toLowerCase().trim(),
		school_name: zod.string().toLowerCase().trim().optional(),
		tot: zod.string().toLowerCase().trim(),
		district_code: zod.string().toLowerCase().trim().optional(),
		district_name: zod.string().toLowerCase().trim().optional(),
		ns1: zod.string().toLowerCase().trim().optional(),
		ns2: zod.string().toLowerCase().trim().optional(),
		ns3: zod.string().toLowerCase().trim().optional(),
		ns4: zod.string().toLowerCase().trim().optional(),
		xs1: zod.string().toLowerCase().trim().optional(),
		xs2: zod.string().toLowerCase().trim().optional(),
		xs3: zod.string().toLowerCase().trim().optional(),
		cs1: zod.string().toLowerCase().trim().optional(),
		cs2: zod.string().toLowerCase().trim().optional(),
		ss1: zod.string().toLowerCase().trim().optional(),
		ss2: zod.string().toLowerCase().trim().optional(),
		disability_l: zod.string().toLowerCase().trim().optional(),
		disability_b: zod.string().toLowerCase().trim().optional(),
		disability_d: zod.string().toLowerCase().trim().optional(),
		disability_p: zod.string().toLowerCase().trim().optional(),
		yob: zod.string().toLowerCase().trim(),
		citizenship: zod.string().toLowerCase().trim().optional(),
		school_code: zod.string().toLowerCase().trim().optional(),
		school_category: zod.string().toLowerCase().trim().optional(),
		selected_school: zod.string().toLowerCase().trim().optional()
	})
	.transform(res => ({
		name: res.name,
		gender: res.ge,
		yearOfBirth: res.yob,
		citizenship: res.citizenship,
		indexNo: res.index_no,
		marks: res.tot,
		primarySchool: {
			name: res.school_name,
			knecCode: res.school_code,
			districtName: res.district_name,
			districtCode: res.district_code
		},
		disability: {
			l: res.disability_l,
			b: res.disability_b,
			d: res.disability_d,
			p: res.disability_p
		},
		preferredSecondarySchools: {
			nationals: {
				ns1: res.ns1,
				ns2: res.ns2,
				ns3: res.ns3,
				ns4: res.ns4
			},
			extraCounty: {
				xc1: res.xs1,
				xc2: res.xs2,
				xc3: res.xs3
			},
			county: {
				cs1: res.cs1,
				cs2: res.cs2
			},
			secondary: {
				ss1: res.ss1,
				ss2: res.ss2
			}
		},
		selectedSchool: {
			category: res.school_category,
			knecCode: res.selected_school
		}
	}));

const admissionSchema = resultsSchema.and(
	zod
		.object({
			method: zod.string().toLowerCase().trim().optional(),
			schooladmitted: zod.string().toLowerCase().trim().optional(),
			category2: zod.string().toLowerCase().trim().optional()
		})
		.transform(res => ({
			schoolAdmitted: {
				method: res.method,
				originalString: res.schooladmitted,
				category: res.category2,
				...(res.schooladmitted?.match(
					/(?<code>\d+).+(?<name>(?<=\d )[a-zA-Z ].+)School Type:(?<type>[a-zA-Z]+).School Category:(?<category>[a-zA-Z].+)/
				)?.groups as { code: string; type: string })
			}
		}))
);

const reportedSchema = zod
	.object({
		index_no: zod.string().toLowerCase().trim().optional(),
		institution_code: zod.string().toLowerCase().trim().optional(),
		upi: zod.string().toLowerCase().trim().optional(),
		birthcert: zod.string().toLowerCase().trim().optional(),
		datereported: zod.union([zod.coerce.date(), zod.string().toLowerCase().trim().optional()]),
		capturedby: zod.string().toLowerCase().trim().optional(),
		name: zod.string().toLowerCase().trim(),
		institutionname: zod.string().toLowerCase().trim().optional()
	})
	.transform(res => ({
		name: res.name,
		indexNo: res.index_no,
		upi: res.upi,
		birthCertificateNo: res.birthcert,
		dateReported: res.datereported,
		capturedBy: res.capturedby,
		institution: {
			name: res.institutionname,
			code: res.institution_code
		}
	}));

const reportedCapturedSchema = reportedSchema.and(
	zod
		.object({
			reportedlabel: zod.string().toLowerCase().trim().optional()
		})
		.transform(res => ({
			reported: {
				originalString: res.reportedlabel,
				...res?.reportedlabel?.match(
					/(?<code>^\d+): (?<name>.+), type: (?<type>.*), category: (?<category>.*), upi: (?<upi>.*)/i
				)?.groups
			}
		}))
);
const admissionApiResponseSchema = zod.object({
	results: zod.union([apiError, resultsSchema]),
	admission: zod.union([apiError, admissionSchema]),
	reported: zod.union([apiError, reportedSchema]),
	captured: zod.union([apiError, reportedCapturedSchema])
});

const listAdmittedLearnerSchema = zod
	.object({
		Index: zod.coerce.string().trim().toLowerCase().optional(),
		Name: zod.coerce.string().trim().toLowerCase().optional(),
		Gender: zod.coerce.string().trim().toLowerCase().optional(),
		'Year of Birth': zod.coerce.string().trim().toLowerCase().optional(),
		Marks: zod.coerce.number(zod.coerce.string().trim().toLowerCase()).optional(),
		'Sub-County': zod.coerce.string().trim().toLowerCase().optional(),
		UPI: zod.union([zod.undefined(), zod.coerce.string().trim().toLowerCase()]).optional(),
		no: zod.number().optional(),
		postback: zod.coerce.string().optional(),
		actions: zod.object({
			captureWithBirthCertificate: zod.coerce.string().optional(),
			captureWithoutBirthCertificate: zod.coerce.string().optional(),
			resetBiodataCapture: zod.coerce.string().optional(),
			undoAdmission: zod.coerce.string().optional()
		})
	})
	.transform(x => {
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

const listLearnerSchema = zod
	.object({
		'Learner UPI': zod.string().trim().toLowerCase(),
		'Learner Name': zod.string().trim().toLowerCase(),
		Gender: zod.string().trim().toLowerCase(),
		'Date of Birth': /*zod.coerce.date(*/ zod.string().transform(x => {
			let s = x.split('-');
			return [s[1], s[0], s[2]].join('-');
		}),
		AGE: zod.coerce.number(),
		'Birth Cert No': zod.string().trim().toLowerCase(),
		Disability: zod.coerce.boolean(),
		'Medical Condition': zod.string().trim().toLowerCase(),
		'Home Phone': zod.string().trim().toLowerCase(),
		'NHIF No': zod.string()
	})
	.transform(x => ({
		upi: x['Learner UPI'],
		name: x['Learner Name'],
		gender: x['Gender'],
		dob: x['Date of Birth'], //new Date(.setDate(x["Date of Birth"].getDate() + 1)),
		age: x['AGE'],
		birthCertificateNo: x['Birth Cert No'],
		isSpecial: x['Disability'],
		medicalCondition: x['Medical Condition'],
		homePhone: x['Home Phone'],
		nhifNo: x['NHIF No']
	}));

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

const INSTITUTION_OWNER_TYPE = ['GOK', 'Mission', 'Private'] as const;
const OWNERSHIP_DOCUMENT_TYPE = ['Lease', 'Title Deed', 'Agreement'] as const;
const INSTITUTION_TYPE = ['Public', 'Private'] as const;
const INSTITUTION_REGISTRATION_STATUS = ['Registered', 'Re-Registered', 'Suspended'] as const;
const INSTITUTION_CATEGORY = [
	'Integrated',
	'Regular',
	'Regular with Special Unit',
	'Special School'
] as const;
const INSTITUTION_LEVEL = [
	'ECDE',
	'Primary',
	'Secondary',
	'TTC',
	'TVET',
	'JSS',
	'A-Level',
	'Pre-vocational'
] as const;
const INSTITUTION_MOBILITY_TYPE = ['Static', 'Mobile'] as const;
const INSTITUTION_ACCOMMODATION_TYPE = ['Day', 'Boarding', 'Daya and Boarding'] as const;
const INSTITUTION_RESIDENCE = ['Rural', 'Urban'] as const;
const EDUCATION_SYSTEM = ['8.4.4/CBC', 'IGSCE', 'Both', 'TVET'] as const;
const INSTITUTION_GENDER = ['Boys', 'Girls', 'Mixed'] as const;
let supportedGradesSchema = zod
	.array(
		zod
			.object({
				class_Name: zod.string().trim().toLowerCase()
			})
			.transform(x => x.class_Name)
	)
	.pipe(gradesSchema.array());

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
	educationLevel: zod
		.string()
		.trim()
		.pipe(zod.enum(INSTITUTION_LEVEL))
		.transform(level => {
			return {
				description: level,
				code: INSTITUTION_LEVEL.findIndex(x => level === x) + 1
			};
		}),
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

export {
	INSTITUTION_OWNER_TYPE,
	OWNERSHIP_DOCUMENT_TYPE,
	INSTITUTION_TYPE,
	INSTITUTION_REGISTRATION_STATUS,
	INSTITUTION_CATEGORY,
	INSTITUTION_LEVEL,
	INSTITUTION_MOBILITY_TYPE,
	INSTITUTION_ACCOMMODATION_TYPE,
	INSTITUTION_RESIDENCE,
	EDUCATION_SYSTEM,
	INSTITUTION_GENDER,
	requestingJoiningLearnerSchema,
	listLearnerSchema,
	institutionSchema,
	searchLearnerSchema,
	admissionApiResponseSchema,
	admissionSchema,
	listAdmittedLearnerSchema
};
