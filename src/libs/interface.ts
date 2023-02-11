/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Grades} from '../interfaces';

export interface ListLearner {
	upi: string;
	name: string;
	gender: string;
	dob: string;
	age: number;
	isSpecial: boolean;
	birthCertificateNo: string;
	medicalCondition: string;
	nhifNo: number;
	doPostback: string;
	grade: Grades;
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
	name: string;
	dob: string;
	upi: string;
	gender: 'M' | 'F';
	birthCertificateNo: string;
	classCode: number;
	grade: string;
	isSpecial: boolean;
	nhifNo: number;
	isLearner: boolean;
	currentInstitution: {
		name: string;
		code: string;
		type: string;
		level: string;
	};
	nationality: string | number;
	countyNo: number;
	subCountyNo: number;
	father: {
		name: string;
		id: string;
		phone: string;
		upi: string;
	};
	mother: {
		name: string;
		id: string;
		phone: string;
		upi: string;
	};
	guardian: {
		name: string;
		id: string;
		phone: string;
		upi: string;
	};
	postalAddress: string;
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
	disability?: {b?: string; d?: string; l?: string; p?: string};
	schoolReported?: ParsedLabel;
	schoolAdmitted?: ParsedLabel;
	schoolSelected?: {level?: string; code?: string; name?: string};
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

export interface CaptureRequestingLearner {
	indexNo: string;
	parent: {
		tel: string;
		id: string;
	};
	adm: string;
	requestedBy?: string;
}

export interface AdmitApiCall {
	name: string;
	gender: string;
	citizenship: string;
	indexNo: string;
	marks: string;
	disability: {b: string; d: string; l: string; p: string};
	schoolAdmitted: ParsedLabel;
	schoolSelected: {
		level: string;
		code: string;
		name: string;
	};
	selectionMethod: string;
	previousSchool: {
		name: string;
		code: string;
	};
	preferredSchools: {
		national: {
			first: string;
			second: string;
			third: string;
			fourth: string;
		};
		extraCounty: {
			first: string;
			second: string;
			third: string;
		};
		county: {
			first: string;
			second: string;
		};
		secondary: {
			first: string;
			second: string;
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

export type RequestedJoiningLearner = ApprovedLearner;

export interface SchoolSelected {
	originalString?: string;
	code: string;
	name: string;
	type: string;
	category: string;
}

export interface ApprovedLearner {
	no: string;
	indexNo: string;
	name: string;
	gender: string;
	marks: string;
	schoolSelected: SchoolSelected;
	requestedBy: string;
	parentId: string;
	parentTel: string;
	dateCaptured: string;
	approved: {
		by: string;
		on: string;
	};
	status: string;
}
