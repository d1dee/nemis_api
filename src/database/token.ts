/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import * as mongoose from 'mongoose';

export default mongoose.model(
	'token',
	new mongoose.Schema({
		token: String,
		// A random string that is used to verify the token
		tokenSecret: String,
		// Creation date of token
		createdAt: {
			type: Date,
			default: Date.now()
		},
		// Expiry date of token
		expires: {
			type: Date,
			default: Date.now() + 2.592e9
		},
		// Institution associated with this token
		institutionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'institution'
		},
		// Reason for the token to be revoked (e.g. user logged out)
		revoked: {
			on: {
				type: Date
			},
			by: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'institution'
			},
			reason: String
		},
		// Archived when the institution is archived
		archived: {
			type: Boolean,
			default: false
		}
	})
);