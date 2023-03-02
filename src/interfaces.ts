/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Request} from 'express';
import {ObjectId} from 'mongoose';
import {Nemis} from './libs/nemis'; //Learner
import {JWTToken, QueryParams, TokenFromDb} from './middleware/interfaces';
import Response from './middleware/response';

//Learner
export interface BasicLearner {
	adm?: string;
	name?: string;
	grade?: Grades;
	stream?: string;
	upi?: string;
	gender?: string;
	dob?: any; //parse to date
}

export interface BasicContact {
	name: string;
	id: string;
	tel: string;
}

export interface Contacts {
	father: BasicContact;
	mother: BasicContact;
	guardian: BasicContact;
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

export interface NemisLearnerFromDb extends NemisLearner {
	error?: string;
	nemisApiResultsId: string | ObjectId;
	_id: string | ObjectId;
	__v?: number;
	institutionId?: ObjectId | string;
	admitted?: boolean;
	reported?: boolean;
}

export interface BasicName {
	surname: string;
	firstname: string;
	otherName: string;
}

export interface ListLearners extends NemisLearner {
	no: number;
	doPostback: string;
}

// Institution
interface Location {
	constituency?: string;
	zone?: string;
	ward?: string;
	plusCode?: string;
}

export interface Institution extends Counties, Location {
	name?: string;
	code?: string;
	gender?: string;
	knecCode?: string;
	type?: string;
	registrationNumber?: string;
	cluster?: string;
	accommodation?: string;
	kraPin?: string;
	registrationStatus?: string;
	tscCode?: string;
	category?: string;
	educationLevel?: string;
	institutionMobility?: string;
	residence?: string;
	educationSystem?: string;
	registrationDate?: string;
	ownership?: string;
	ownershipDocument?: string;
	owner?: string;
	incorporationCertificateNumber?: string;
	nearestPoliceStation?: string;
	nearestHealthFacility?: string;
	nearestTown?: string;
	postalAddress?: string;
	telephoneNumber?: string;
	mobileNumber?: string;
	altTelephoneNumber?: string;
	altMobileNumber?: string;
	email?: string;
	website?: string;
	socialMediaHandles?: string;
}

export interface DbInstitution extends Institution {
	_id?: string;
	__v?: number;
	username?: string;
	password?: string;
	cookie?: {
		value: string;
		expires: Date | number;
	};
	createdAt?: Date | number;
	lastLogin?: Date | number;
	token?: string;
	revokedToken?: string;
	learners?:
		| [
		{
			type: string;
			ref: 'learner';
		}
	]
		| Number;
	teachers?:
		| [
		{
			type: string;
			ref: 'teacher';
		}
	]
		| Number;
	nonTeaching?:
		| [
		{
			type: string;
			ref: 'nonTeaching';
		}
	]
		| Number;
}

export interface ExtendedRequest extends Request {
	req: JWTToken;
	nemis: Nemis;
	decodedToken: JWTToken;
	institution: DbInstitution;
	token: TokenFromDb;
	response: Response;
	queryParams: QueryParams;
}

export type Grades =
	| 'form 1'
	| 'form 2'
	| 'form 3'
	| 'form 4'
	| 'pp 1'
	| 'pp 2'
	| 'grade 1'
	| 'grade 2'
	| 'grade 3'
	| 'grade 4'
	| 'grade 5'
	| 'grade 6'
	| 'grade 7'
	| 'grade 8'
	| 'grade 9'
	| 'grade 10'
	| 'grade 11';
