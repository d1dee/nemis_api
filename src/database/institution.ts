/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import * as mongoose from 'mongoose';

export default mongoose.model(
	'institution',
	new mongoose.Schema({
		// User passed username and password during registration
		// TODO: encrypt password
		username: {
			type: String,
			required: true,
			index: {
				unique: true,
				partialFilterExpression: {username: {$exists: true, $type: 'string'}}
			}
		},
		password: {type: String, required: true},
		// Last received cookie from nemis website
		cookie: {
			value: {type: String, index: true},
			expires: {
				type: Date,
				default: Date.now() + 3.6e6
			}
		},
		createdAt: {type: Date, default: Date.now()},
		lastLogin: {type: Date, default: Date.now()},
		// Current token
		token: {
			index: true,
			type: mongoose.Schema.Types.ObjectId,
			ref: 'token'
		},
		// Ids of all previous tokens
		revokedToken: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'token'
		},
		// Inferred from other pages
		learners: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'learner'
			}
		],
		teachers: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'teacher'
			}
		],
		nonTeaching: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'nonTeaching'
			}
		],
		// Populated form http://nemis.education.go.ke/Institution/Institution.aspx
		name: {type: String, index: true},
		code: {type: String, index: true},
		gender: String,
		knecCode: String,
		type: String,
		registrationNumber: String,
		cluster: String,
		accommodation: String,
		constituency: String,
		zone: String,
		ward: String,
		kraPin: String,
		plusCode: String,
		registrationStatus: String,
		tscCode: String,
		category: String,
		educationLevel: String,
		institutionMobility: String,
		residence: String,
		educationSystem: String,
		registrationDate: String,
		county: String,
		subCounty: String,
		ownership: String,
		ownershipDocument: String,
		owner: String,
		incorporationCertificateNumber: String,
		nearestPoliceStation: String,
		nearestHealthFacility: String,
		nearestTown: String,
		postalAddress: String,
		telephoneNumber: String,
		mobileNumber: String,
		altTelephoneNumber: String,
		altMobileNumber: String,
		email: String,
		website: String,
		socialMediaHandles: String,
		// If the institution has been archived
		archived: Boolean
	})
);
