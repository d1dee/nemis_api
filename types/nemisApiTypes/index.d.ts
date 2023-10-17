/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
import { z as zod } from 'zod';
import mongoose, { Document } from 'mongoose';
import { completeLearnerSchema, genderSchema, gradesSchema, nationalitiesSchema } from '@libs/zod_validation';
import {
	admissionApiResponseSchema,
	admissionSchema,
	institutionSchema,
	listAdmittedLearnerSchema,
	listLearnerSchema,
	requestingJoiningLearnerSchema,
	searchLearnerSchema
} from '@libs/nemis/validations';

/**
 * Continuing learner_router for a database
 */
export type ContinuingLearnerType = Omit<NemisLearnerFromDb, 'ObjectId'> & {
	institutionId: mongoose.Types.ObjectId;
	continuing: boolean;
	birthCertificateNo: string;
	indexNo: string;
};

/**
 * A learner_router joining the school for the first time ie form 1 in secondary schools.
 */
export type RequestingJoiningLearner = zod.infer<typeof requestingJoiningLearnerSchema>;

/**
 * A standard learner_router, this is a base learner_router where all other learners are derived from
 */
export type CompleteLearner = zod.infer<typeof completeLearnerSchema>;

export type CompleteDatabaseLearner = CompleteLearner & {
	error?: string;
	nemisApiResultsId?: mongoose.Types.ObjectId;
	institutionId: mongoose.Types.ObjectId;
	admitted?: boolean;
	reported?: boolean;
	nhifNo?: number;
};

/**
 * Learner returned by http://nemis.education.go.ke/Learner/Listlearners.aspx on the NEMIS website
 */
export type ListLearner = zod.infer<typeof listLearnerSchema> & {
	doPostback: string;
	grade: Grades;
};

/**
 * List of learners awaiting biodata capture and is returned by http://nemis.education.go.ke/Admission/Listlearnersrep.aspx
 */

export type ListAdmittedLearner = zod.infer<typeof listAdmittedLearnerSchema>;

export type Grades = zod.infer<typeof gradesSchema>;
export type Nationalities = zod.infer<typeof nationalitiesSchema>;
export type Gender = zod.infer<typeof genderSchema>;
export type AdmissionApiResults = zod.infer<typeof admissionSchema>;
export type Institution = zod.infer<typeof institutionSchema>;

export type AdmitApiResponses = zod.infer<typeof admissionApiResponseSchema>;
export type SearchLearnerApiResponses = zod.infer<typeof searchLearnerSchema>;

export interface JoiningLearnerBiodata extends CompleteLearner {
	postback: string;
	birthCertificateNo: string;
	actions: {
		captureWithBirthCertificate: string;
		captureWithoutBirthCertificate: string;
		resetBiodataCapture: string;
		undoAdmission: string;
	};
}

export type CaptureBiodataResponse = { upi?: string; message: string; alertMessage?: string };

export interface DatabaseInstitution extends Institution, Document {
	username: string;
	password: string;
	createdAt: Date;
	lastLogin: Date;
	token?: mongoose.Types.ObjectId;
	// Ids of all previous tokens
	revokedTokens: mongoose.Types.ObjectId[];
	isArchived: boolean;
}

export interface DatabaseToken extends Document {
	token?: string;
	tokenSecret: string;
	createdAt: Date;
	expires: Date;
	institutionId: mongoose.Types.ObjectId;
	revoked?: {
		on?: Date;
		by?: mongoose.Types.ObjectId;
		reason?: String;
	};
	archived: boolean;
}

export interface QueryParams {
	dob?: Date;
	admitted?: boolean;
	birthCertOrUpi?: string[];
	nhif?: boolean;
	adm?: string[];
	fields?: string[];
	sort?: string;
	//upi?: string;
	limit?: number;
	grade?: Grades;
	approved?: boolean;
	indexNo?: string[];
	await?: boolean;
	ignoreNonEssentialBlanks?: boolean;
	stream?: string;
}

export interface RequestingLearner extends BasicName {
	no?: number;
	name: string;
	adm: string;
	gender: string;
	kcpeYear: number;
	indexNo: string;
	birthCertificateNo: string;
	grade: Grades;
	remarks: string;
	upi?: string;
	postback?: string;
}

//Learner
export interface BasicLearner {
	adm: string;
	name: string;
	grade: Grades;
	stream?: string;
	upi?: string;
	gender: string;
	dob: Date; //parse to date
}

export interface BasicContact {
	name?: string;
	id?: string;
	tel?: string;
}

export interface Contacts {
	father?: BasicContact;
	mother?: BasicContact;
	guardian?: BasicContact;
	address?: string;
}

export interface Counties {
	countyNo?: number;
	subCountyNo?: number;
	county?: string;
	subCounty?: string;
}

export interface NemisLearner extends BasicLearner, Contacts, Counties {
	birthCertificateNo?: string;
	nhifNo?: number;
	continuing?: boolean;
	medicalCondition?: string;
	isSpecial?: boolean;
	age?: number;
	marks?: number;
	indexNo?: string;
	nationality?: string;
	remarks?: string;
	kcpeYear?: number;
}

export interface NemisLearnerFromDb extends NemisLearner, Document {
	error?: string;
	nemisApiResultsId?: mongoose.Types.ObjectId;
	institutionId: mongoose.Types.ObjectId;
	admitted?: boolean;
	reported?: boolean;
}

export interface BasicName {
	surname: string;
	firstname: string;
	otherName: string;
}

export interface SelectedLearner {
	indexNo: string;
	name: string;
	gender: string;
	yearOfBirth: number;
	marks: number;
	subCounty: string;
}

export interface BioDataReturn {
	error?: {
		message: string;
		type: string;
		time: number;
	};
	success?: {
		upi: string;
		time: number;
	};
}

export interface StateObject {
	__VIEWSTATEGENERATOR: string;
	__EVENTARGUMENT?: string;
	__VIEWSTATE: string;
	__VIEWSTATEENCRYPTED?: string;
	__LASTFOCUS?: string;
	__EVENTTARGET?: string;
	__EVENTVALIDATION: string;
}

export interface NhifResponse {
	nhifNo: string;
	nhifStatus: string;
}

export interface ErrorResponse {
	message?: string;
	type?: string;
	data?: Error;
	time?: number | Date | string;
	error?: Error;
}

export interface FormattedCustomError{
	message:string,
	responseErrorCode:number
	error?:any
}

export interface AxiosCustomRequestHeaders {
	'Cache-Control'?: string;
	'X-Requested-With'?: string;
	'X-MicrosoftAjax'?: string;
	'Upgrade-Insecure-Requests'?: string;
	'Content-Type'?: string;
	'User-Agent'?: string;
	Accept?: string;
	host?: string;
}

export interface SearchLearner {
	name?: string;
	dob?: string;
	upi?: string;
	gender?: 'M' | 'F';
	birthCertificateNo?: string;
	classCode?: number;
	grade?: string;
	isSpecial?: boolean;
	nhifNo?: number;
	isLearner?: boolean;
	currentInstitution?: {
		name?: string;
		code?: string;
		type?: string;
		level?: string;
	};
	nationality?: string | number;
	countyNo?: number;
	subCountyNo?: number;
	father?: {
		name?: string;
		id?: string;
		phone?: string;
		upi?: string;
	};
	mother?: {
		name?: string;
		id?: string;
		phone?: string;
		upi?: string;
	};
	guardian?: {
		name?: string;
		id?: string;
		phone?: string;
		upi?: string;
	};
	postalAddress?: string;
}

interface PreferredSchools {
	first?: string;
	second?: string;
	third?: string;
	fourth?: string;
}

export interface AdmitOrCaptureRequestApiCalls {
	name?: string;
	gender?: string;
	upi?: string;
	birthCertificateNo?: string;
	citizenship?: string;
	indexNo?: string;
	marks?: number;
	placementHistory?: string;
	religionCode?: string;
	reported?: {
		date?: string;
		institutionName?: string;
		institutionCode?: string;
	};
	disability?: { b?: string; d?: string; l?: string; p?: string };
	schoolReported?: ParsedLabel;
	schoolAdmitted?: ParsedLabel;
	schoolSelected?: { level?: string; code?: string; name?: string };
	selectionMethod?: string;
	previousSchool?: {
		name?: string;
		code?: string;
	};
	preferredSchools?: {
		national?: PreferredSchools;
		extraCounty?: PreferredSchools;
		county?: PreferredSchools;
		secondary?: PreferredSchools;
	};
	choiceNo?: string;
	districtRank?: number;
	nationalRank?: number;
}

export interface ParsedLabel {
	originalString?: string;
	code?: string;
	name?: string;
	type?: string;
	category?: string;
}

export interface AdmitApiCall {
	name: string;
	gender: string;
	citizenship: string;
	indexNo: string;
	marks: string;
	disability?: { b: string; d: string; l: string; p: string };
	schoolAdmitted?: ParsedLabel;
	schoolSelected?: {
		level: string;
		code: string;
		name: string;
	};
	selectionMethod?: string;
	previousSchool?: {
		name: string;
		code: string;
	};
	preferredSchools?: {
		national?: {
			first?: string;
			second?: string;
			third?: string;
			fourth?: string;
		};
		extraCounty?: {
			first?: string;
			second?: string;
			third?: string;
		};
		county?: {
			first?: string;
			second?: string;
		};
		secondary?: {
			first?: string;
			second?: string;
		};
	};
}

export interface AdmittedJoiningLearners {
	postback: 'ctl00$ContentPlaceHolder1$grdLearners';
	actions: {
		captureWithBirthCertificate: string;
		captureWithoutBirthCertificate: string;
		resetBiodataCapture: string;
		undoAdmission: string;
	};
	no: number;
	indexNo: string;
	name: string;
	gender: string;
	yob: number;
	marks: number;
	subCounty: string;
	upi: string;
}

export interface RequestedJoiningLearner extends ApprovedLearner {}

export interface SchoolSelected {
	originalString?: string;
	code: string;
	name: string;
	type: string;
	category: string;
}

export interface ApprovedLearner {
	no?: string;
	indexNo?: string;
	name?: string;
	gender?: string;
	marks?: string;
	schoolSelected?: SchoolSelected;
	requestedBy?: string;
	parentId?: string;
	parentTel?: string;
	dateCaptured?: string;
	approved?: {
		by?: string;
		on?: string;
	};
	status?: string;
}

export interface ContinuingLearnerApiResponse {
	xcat?: string;
	isLearner: boolean;
	isLearnerDescription?: string;
	upi?: string;
	names?: string;
	surname?: string;
	firstName?: string;
	otherNames?: string;
	institutionName?: string;
	phoneNumber?: string;
	emailAddress?: string;
	postalAddress?: string;
	fatherUpi?: string;
	motherUpi?: string;
	guardianUpi?: string;
	fatherName?: string;
	fatherIdno?: string;
	fatherContacts?: string;
	motherName?: string;
	motherIdno?: string;
	motherContacts?: string;
	guardianContacts?: string;
	guardianIdno?: string;
	guardianName?: string;
	specialMedicalCondition?: string;
	anySpecialMedicalCondition?: string;
	institutionCode?: string;
	subCountyCode?: string;
	nationality?: string;
	gender?: string;
	lgender?: string;
	dob?: string;
	doB2?: string;
	isDateDOB?: string;
	birthCertificateNo?: string;
	idNo?: string;
	disabilityCode?: string;
	classCode?: string;
	countyCode?: string;
	countyLearner?: string;
	subCountyLearner?: string;
	specialNeedsList?: string;
	fatherEmail?: string;
	motherEmail?: string;
	guardianEmail?: string;
	institutionType?: string;
	institutionLevelCode?: string;
	nhifNo?: string;
	className?: string;
	levelName?: string;
}
