/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import mongoose from 'mongoose';

export default mongoose.model(
	'nemisLearner',
	new mongoose.Schema({
		upi: {
			type: String,
			unique: true,
			upsert: true,
			index: {
				unique: true,
				partialFilterExpression: {tokenId: {$exists: true, $type: 'string'}}
			},
			collation: {locale: 'en', strength: 2}
		},
		name: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2}
		},
		form: {
			type: Number,
			enum: [1, 2, 3, 4],
			index: true
		},
		doPostback: String,
		lastUpdate: {type: Date, default: Date.now},
		indexNo: {type: Number, index: true, sort: true},
		dob: Date,
		father: {
			name: {
				type: String,
				index: true,
				collation: {locale: 'en', strength: 2}
			},
			tel: String,
			id: String
		},
		mother: {
			name: {
				type: String,
				index: true,
				collation: {locale: 'en', strength: 2}
			},
			tel: String,
			id: String
		},
		guardian: {
			name: {
				type: String,
				index: true,
				collation: {locale: 'en', strength: 2}
			},
			tel: String,
			id: String
		},
		address: String,
		birthCertificateNo: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2, numericOrdering: true}
		},
		county: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2}
		},
		countyNo: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2}
		},
		subCounty: String,
		subCountyNo: Number,
		gender: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2}
		},
		nationality: String,
		isSpecial: Boolean,
		medicalCondition: String,
		inst: mongoose.Schema.Types.ObjectId,
		learner_id: mongoose.Schema.Types.ObjectId
	})
);
