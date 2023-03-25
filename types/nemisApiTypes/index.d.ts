/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {ObjectId} from 'mongoose';
import {NemisLearner, NemisLearnerFromDb} from '../../src/interfaces';

export type ContinuingLearnerType = (Omit<NemisLearnerFromDb, 'ObjectId'> & {
	institutionId: ObjectId
	continuing: boolean
	birthCertificateNo: string
	indexNo: string
})

export type InvalidExcelDataObject = Partial<NemisLearner> & {
	errors: {
		validationErrors: {
			[Property in keyof NemisLearner]: string;
		}
	}
}

export interface ValidateExcel {
	valid: NemisLearner[];
	invalid: InvalidExcelDataObject[];
}