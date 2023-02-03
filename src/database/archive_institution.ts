/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import * as mongoose from 'mongoose';

export default mongoose.model(
	'archived_inst',
	new mongoose.Schema({
		tokenId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'token',
			required: true,
			index: {
				unique: true,
				partialFilterExpression: {tokenId: {$exists: true, $type: 'string'}}
			}
		},
		archivedAt: {
			type: Date,
			required: true,
			default: Date.now(),
			index: true
		},
		institutionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'institution',
			required: true,
			index: true
		}
	})
);
