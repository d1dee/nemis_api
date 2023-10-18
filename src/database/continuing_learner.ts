/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose from 'mongoose';

export default mongoose.model(
	'continuingLearner',
	new mongoose.Schema({
		name: {
			type: String,
			required: true,
			index: {
				partialFilterExpression: {name: {$exists: true, $type: 'string'}}
			},
			collation: {
				locale: 'en',
				strength: 2
			}
		},
		adm: {
			type: String,
			required: true,
			index: {
				unique: true,
				partialFilterExpression: {adm: {$exists: true, $type: 'string'}}
			},
			collation: {
				locale: 'en',
				strength: 2
			}
		},
		gender: String,
		kcpeYear: Number,
		indexNo: {
			type: String,
			index: {
				indexNo: true,
				partialFilterExpression: {upi: {$exists: true, $type: 'string'}}
			}
		},
		birthCertificateNo: {
			type: String,
			required: true,
			index: {
				unique: true,
				partialFilterExpression: {birthCertificateNo: {$exists: true, $type: 'string'}}
			},
			collation: {
				locale: 'en',
				strength: 2
			}
		},
		grade: {
			type: String,
			enum: [
				'form 1',
				'form 2',
				'form 3',
				'form 4',
				'pp 1',
				'pp 2',
				'grade 1',
				'grade 2',
				'grade 3',
				'grade 4',
				'grade 5',
				'grade 6',
				'grade 7',
				'grade 8',
				'grade 9',
				'grade 10',
				'grade 11'
			]
		},
		remarks: String,
		upi: {
			type: String,
			index: {
				unique: true,
				partialFilterExpression: {upi: {$exists: true, $type: 'string'}}
			},
			collation: {
				locale: 'en',
				strength: 2
			}
		},
		postback: {
			type: String,
			index: {
				unique: true,
				partialFilterExpression: {postback: {$exists: true, $type: 'string'}}
			}
		},
		learnerId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'learner'
		},

	})
);
