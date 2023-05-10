/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { accessSync, constants } from 'fs';
import { readFile, utils, WorkBook } from 'xlsx';
import { z as zod, ZodIssue } from 'zod';
import { CompleteLearner } from '../../types/nemisApiTypes';
import { lowerCaseAllValues } from './converts';
import { completeLearnerSchema } from './zod_validation';
import CustomError from './error_handler';

// Convert an Excel file to json and sanitize its data
const validateExcel = (
	filePath: string
): Array<CompleteLearner & { validationError?: ZodIssue }> => {
	try {
		accessSync(filePath, constants.R_OK);
		let workBook: WorkBook = readFile(filePath, { dateNF: 'yyyy-mm-dd', cellDates: true });
		if (workBook.SheetNames.length < 1) {
			throw new CustomError(
				'Invalid file format. No sheets with data were found.' +
					'The workbook should have at least one sheet containing learner data.',
				400
			);
		}
		if (workBook.SheetNames.length > 1) {
			throw new CustomError(
				'Invalid file format. More than one sheet was found.' +
					'Please remove all unnecessary sheets and upload a file with only one sheet containing learner data.',
				400
			);
		}
		// Parse sheetData
		const sheetData = utils.sheet_to_json(workBook.Sheets[workBook.SheetNames[0]]);

		// check if all keys are correct
		if (!Array.isArray(sheetData) || sheetData.length === 0) {
			throw new CustomError(
				`Failed to convert sheet data.
             The worksheet \'${workBook.SheetNames[0]}\' may not contain any data or the data could not be processed. 
             xlsx.utils.sheet_to_json did not return an array or returned an empty array.`,
				400
			);
		}

		return sheetData.map(x => validateLearnerJson(lowerCaseAllValues(x)));
	} catch (err: any) {
		throw err;
	}
};
/**
 Validates a learner_router object based on a Zod schema and applies additional custom validation logic.
 @param {any} obj - The learner_router object to be validated.
 @returns {CompleteLearner | (CompleteLearner & { validationError: ZodIssue })} - Returns a
 CompleteLearner object if the validation is successful,
 or a CompleteLearner object with a validation error property if the validation fails.
 @throws {Error} - Throws an error if there is an issue during validation.
 */

const validateLearnerJson = (obj: any): CompleteLearner & { validationError?: ZodIssue } => {
	try {
		completeLearnerSchema.superRefine((value, ctx) => {
			if (
				value.birthCertificateNo &&
				value?.birthCertificateNo?.length < 7 &&
				obj?.nationality === 'kenya'
			) {
				ctx.addIssue({
					code: zod.ZodIssueCode.custom,
					message:
						'Kenyan birth certificate entry numbers should be more' +
						' than 7 (seven) characters long.'
				});
			}
		});

		// Prepare the object for validation
		let objectToValidate = {
			...obj,
			dob:
				obj.dob instanceof Date
					? (() =>
							// Fix off by 1 Date error
							obj.dob.setDate(obj.dob.getDate() + 1))()
					: obj.dob,
			father: {
				name: obj?.fatherName,
				tel: obj?.fatherTel,
				id: obj?.fatherId
			},
			mother: {
				name: obj?.motherName,
				tel: obj?.motherTel,
				id: obj?.motherId
			},
			guardian: {
				name: obj?.guardianName,
				tel: obj?.guardianTel,
				id: obj?.guardianId
			}
		};
		let validatedObject = completeLearnerSchema.safeParse(objectToValidate);
		if (validatedObject.success) {
			return <CompleteLearner>validatedObject.data;
		} else {
			return <CompleteLearner & { validationError: ZodIssue }>{
				...obj,
				validationError: validatedObject.error.flatten().fieldErrors
			};
		}
	} catch (err: any) {
		throw err;
	}
};

export { validateExcel, validateLearnerJson };
