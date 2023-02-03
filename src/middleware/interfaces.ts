/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {ObjectId} from 'mongoose';
import {BasicName, Grades} from '../interfaces';

export interface JWTToken {
	iat: number;
	exp: number;
	id: string;
	cookie: {
		value: string;
		expires: string;
	};
}

export interface TokenFromDb {
	_id: ObjectId | string;
	token: string;
	tokenSecret: string;
	createdAt: Date;
	expires: Date;
	institutionId: string;
	revoked: boolean;
	revokedOn: Date;
	revokedBy: string;
	revokedReason: string;
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
}

export interface SetCookie {
	domain?: string;
	encode?: Function;
	expires?: Date;
	httpOnly?: boolean;
	maxAge?: number;
	path?: string;
	secure?: boolean;
	signed?: boolean;
	sameSite?: boolean;
	or?: string;
}

export interface RequestingLearner extends BasicName {
	no: number;
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
