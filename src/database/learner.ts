/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import mongoose from 'mongoose';

export default mongoose.model(
	'learner',
	new mongoose.Schema({
		adm: {
			type: String,
			required: true,
			index: {
				unique: true,
				partialFilterExpression: {adm: {$exists: true, $type: 'string'}}
			}
		},
		name: {
			type: String,
			required: true,
			index: true,
			collation: {
				locale: 'en',
				strength: 2
			}
		},
		dob: Date,
		marks: Number,
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
			],
			index: true
		},
		indexNo: {
			type: String,
			index: {
				unique: true,
				partialFilterExpression: {indexNo: {$exists: true, $type: 'string'}}
			}
		},
		upi: {
			type: String,
			index: {
				unique: true,
				partialFilterExpression: {upi: {$exists: true, $type: 'string'}}
			},
			collation: {locale: 'en', strength: 2}
		},
		stream: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2}
		},
		institutionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'institution',
			required: true
		},
		// A link between all scrapped data from nemis and api's data
		nemisId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'nemisLearner'
		},
		// Api results from nemis apis
		nemisApiResultsId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'nemisApiResults'
		},
		transfer: {
			out: Boolean, //True if transferring out false when transferring in
			institution: {
				code: String,
				name: String
			}
		},
		// If learner was added as a continuing learner
		continuingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'continuingLearner'
		},
		// A score of how accurate our match algorithm matches api learner name to nemis learner name
		nemisScore: Number,
		// Contacts details
		father: {
			name: {
				type: String,
				index: true,
				collation: {
					locale: 'en',
					strength: 2
				}
			},
			tel: String,
			id: String
		},
		mother: {
			name: {
				type: String,
				index: true,
				collation: {
					locale: 'en',
					strength: 2
				}
			},
			tel: String,
			id: String
		},
		guardian: {
			name: {
				type: String,
				index: true,
				collation: {
					locale: 'en',
					strength: 2
				}
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
		// County and sub-county details
		county: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2}
		},
		subCounty: {
			type: String,
			index: true,
			collation: {locale: 'en', strength: 2}
		},
		countyNo: Number,
		subCountyNo: Number,
		gender: {
			type: String,
			index: true,
			enum: ['male', 'female', 'm', 'f']
		},
		nationality: String,
		admitted: Boolean,
		reported: Boolean,
		isSpecial: Boolean,
		medicalCondition: String,
		error: String
	})
);
