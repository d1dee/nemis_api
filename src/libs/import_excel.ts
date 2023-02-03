/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Temporal} from '@js-temporal/polyfill';
import {accessSync, constants} from 'fs';
import {Error} from 'mongoose';
import Validator from 'validatorjs';
import * as xlsx from 'xlsx';
import {WorkBook} from 'xlsx';
import {Grades, NemisLearner} from '../interfaces';
import {RequestingLearner} from '../middleware/interfaces';
import {countyToNo, form} from './converts';
import {CaptureRequestingLearner} from './interface';
import logger from './logger';

// Covert an Excel file to json and sanitize its data
export default (
	filePath: string
): Array<{validDataObject: NemisLearner[]; invalidDataObject: Partial<NemisLearner>[]}> => {
	try {
		accessSync(filePath, constants.R_OK);
		let workBook: WorkBook = xlsx.readFile(filePath, {cellDates: true});
		if (workBook.SheetNames.length === 0) {
			throw {
				code: 400,
				message: 'No sheets with data were found',
				cause: 'Workbook should have' + ' at least one workbook with learners.'
			};
		}
		// If we only got 1 sheet
		if (workBook.SheetNames.length === 1) {
			// Parse sheetData
			const sheetData = xlsx.utils.sheet_to_json(workBook.Sheets[workBook.SheetNames[0]]);
			return [validateLearnerJson(sheetData)];
		}
		// if we have more than 1 sheet
		else if (workBook.SheetNames.length > 1) {
			//loop through each sheet converting them to json
			return workBook.SheetNames.map(sheetName => {
				// Parse sheetData
				const sheetData = xlsx.utils.sheet_to_json(workBook.Sheets[sheetName]);
				return validateLearnerJson(sheetData);
			});
		}
	} catch (err) {
		logger.error(err);
		throw err;
	}
};

export function validateRequestingLearner(requestingLearners: unknown[]): RequestingLearner {
	try {
		if (!Array.isArray(requestingLearners)) {
			throw new Error(
				'SheetData is not an array, expected xlsx.utils.sheet_to_json() to return a JSON' +
					' object.'
			);
		}

		// Register custom validation rules
		Validator.register(
			'fullName',
			(value: string) => {
				return !!String(value).match(/^[a-zA-Z\W]+(?:\s[a-zA-Z\W]+)+$/);
			},
			'At least two names were expected but only one name was received.'
		);
		Validator.register('string', (value: string) => {
			return !!String(value).trim();
		});
		Validator.register('form', value => {
			try {
				form(value as Grades);
				return true;
			} catch (e) {
				return false;
			}
		});
		const rules = {
			adm: 'string|required',
			name: ['required', 'string', 'fullName'],
			grade: ['required_without:form', 'form'],
			form: ['required_without:grade', 'form'],
			gender: [
				'required',
				'string',
				{in: ['m', 'M', 'f', 'F', 'male', 'Male', 'female', 'Female']}
			],
			birthCertificateNo: ['string', 'required'],
			indexNo: ['string', 'required'],
			kcpeYear: 'string|required',
			remarks: 'string|required'
		};
		let validatedLearners = requestingLearners.map(x => {
			let v = new Validator(x, rules);
			if (v.check()) return x;
			return {...x, validationErrors: v.errors.all()};
		});
		let validationError = validatedLearners.filter(x => x.validationErrors);
		if (validationError.length > 0) {
			throw {
				message: 'ValidationError',
				cause: validationError
			};
		}
		return validatedLearners as unknown as RequestingLearner;
	} catch (err) {
		throw err;
	}
}

export function validateLearnerJson(sheetData: any[]): {
	// todo: massive rewrite here
	validDataObject: NemisLearner[];
	invalidDataObject: unknown[];
} {
	if (!Array.isArray(sheetData)) {
		throw new Error(
			'SheetData is not an array, expected xlsx.utils.sheet_to_json() to return a JSON' +
				' object.'
		);
	}
	// Register custom validation rules
	Validator.register(
		'fullName',
		(value: string) => {
			return !!String(value).match(/^[a-zA-Z\W]+(?:\s[a-zA-Z\W]+)+$/);
		},
		'At least two names were expected but only one name was received.'
	);
	Validator.register(
		'phoneNumber',
		(value: string) => {
			return !!String(value).match(
				/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/
			);
		},
		'No valid phone number was received'
	);

	// Cast everything to string before validating if fails then assume mongo driver will fail too.
	Validator.register('string', (value: string) => {
		return !!String(value).trim();
	});
	Validator.register('form', value => {
		try {
			form(value as Grades);
			return true;
		} catch (e) {
			return false;
		}
	});

	const rules = {
		adm: 'string|required',
		name: ['string', 'fullName'], ///^[a-zA-Z]+(?:\s[a-zA-Z]+)+$/ Add regex validation for names separated by space. Valid if groups less than three throw error
		grade: ['form'],
		form: ['form'],
		stream: ['string'],
		upi: ['string', 'min:4', 'required_without_all:birthCertificateNo'],
		gender: [
			'required',
			'string',
			{in: ['m', 'M', 'f', 'F', 'male', 'Male', 'female', 'Female']}
		],
		fatherName: ['string', 'fullName', 'required_without_all:motherName,guardianName'],
		fatherId: ['string', 'required_without_all:motherId,guardianId'],
		fatherTel: ['numeric', 'phoneNumber', 'required_without_all:motherTel,guardianTel'],
		motherName: ['string', 'fullName', 'required_without_all:fatherName,guardianName'],
		motherId: ['string', 'required_without_all:fatherId,guardianId'],
		motherTel: ['numeric', 'phoneNumber', 'required_without_all:fatherTel,guardianTel'],
		guardianName: ['string', 'fullName', 'required_without_all:fatherName,motherName'],
		guardianId: ['string', 'required_without_all:fatherId,motherId'],
		guardianTel: ['numeric', 'phoneNumber', 'required_without_all:fatherTel,motherTel'],
		address: ['string'],
		county: ['string'],
		subCounty: ['string'],
		birthCertificateNo: ['string', 'required_without_all:upi'],
		medicalCondition: ['string'], // Add includes array of all allowed medical  conditions
		isSpecial: ['boolean'],
		marks: ['integer', 'min:0', 'max:500'],
		// Index is a string to maintain starting zeros in some schools indexNo numbers
		indexNo: ['string', 'required'],
		nationality: ['string']
	};
	const allowedKeys = [
		'adm',
		'name',
		'grade',
		'form',
		'stream',
		'upi',
		'gender',
		'dob',
		'fatherName',
		'fatherId',
		'fatherTel',
		'motherName',
		'motherId',
		'motherTel',
		'guardianName',
		'guardianId',
		'guardianTel',
		'address',
		'county',
		'subCounty',
		'birthCertificateNo',
		'medicalCondition',
		'isSpecial',
		'marks',
		'indexNo',
		'nationality'
	];

	let validDataObject: NemisLearner[] = [],
		invalidDataObject: unknown[] = [];

	sheetData.forEach(dataObject => {
		Object.keys(dataObject).forEach(key => {
			if (!allowedKeys.includes(key)) {
				delete dataObject[key];
			}
		});

		// Get all validation errors
		let validator = new Validator(dataObject, rules);

		if (!validator.check()) {
			const validationError = validator.errors.all();
			const contactsKey = [
				'fatherId',
				'fatherName',
				'fatherTel',
				'motherId',
				'motherTel',
				'motherName',
				'guardianId',
				'guardianTel',
				'guardianName'
			];

			if (contactsKey.every(key => Object.keys(validationError).includes(key))) {
				contactsKey.every(key => delete validationError[key]);
				validationError.contacts = [
					'At least one contact must have a name, id and telephone number.'
				];
			}
			invalidDataObject.push({
				...dataObject,
				errors: {
					validationErrors: validationError
				}
			});
			// todo: this can be easily simplified, do that when bored
			if (
				['fatherId', 'motherId', 'guardianId'].every(key =>
					Object.keys(validationError).includes(key)
				)
			) {
				['fatherId', 'motherId', 'guardianId'].every(key => delete validationError[key]);
				validationError.id = [
					'All contacts are missing Id numbers. At least one contact must have a name,' +
						' id and telephone number.'
				];
			}
			if (
				['fatherTel', 'motherTel', 'guardianTel'].every(key =>
					Object.keys(validationError).includes(key)
				)
			) {
				['fatherTel', 'motherTel', 'guardianTel'].every(key => delete validationError[key]);
				validationError.id = [
					'All contacts are missing Telephone numbers. At least one contact must have' +
						' a name,' +
						' id and telephone number.'
				];
			}
			if (
				['fatherName', 'motherName', 'guardianName'].every(key =>
					Object.keys(validationError).includes(key)
				)
			) {
				['fatherName', 'motherName', 'guardianName'].every(
					key => delete validationError[key]
				);
				validationError.id = [
					'All contacts are missing names. At least one contact must have a' +
						' name,' +
						' id and telephone number.'
				];
			}
		} else {
			if (dataObject.dob) {
				try {
					// Create a Temporal date instead of normal js date Object
					if (dataObject.dob instanceof Date && !isNaN(dataObject.dob)) {
						dataObject.dob = Temporal.PlainDate.from({
							year: dataObject.dob?.getFullYear(),
							month: dataObject.dob?.getMonth() + 1,
							day: dataObject.dob?.getDate()
						});
					} else {
						let date = dataObject.dob.split(/[\/.,\-]/);
						if (date.length != 3) throw undefined;
						if (!Number(date[0]) || !Number(date[1]) || !Number(date[1]))
							throw undefined;
						if (Number(date[1]) > 12) throw 'Month is out of range';
						if (Number(date[0]) > 31) throw 'Day is out of range';
						dataObject.dob = Temporal.PlainDate.from({
							year: Number(date[2]),
							month: Number(date[1]),
							day: Number(date[0])
						});
					}
					validDataObject.push(dataObject);
				} catch (err) {
					invalidDataObject.push({
						...dataObject,
						errors: {
							validationErrors:
								err?.message ||
								'Invalid date, dob should be in form' + ' of Day/Month/year.'
						}
					});
				}
			} else {
				invalidDataObject.push({
					...dataObject,
					errors: {
						validationErrors:
							'Invalid date, dob should be in form' + ' of Day/Month/year.'
					}
				});
			}
			if (!countyToNo(dataObject.county, dataObject.subCounty)) {
				invalidDataObject.push({
					...dataObject,
					errors: {
						validationErrors: 'Invalid county or subCounty name'
					}
				});
			}
		}
	});
	return {validDataObject, invalidDataObject};
}

export function validateCaptureRequest(requestingLearners): CaptureRequestingLearner[] {
	try {
		if (!Array.isArray(requestingLearners)) {
			throw new Error(
				'SheetData is not an array, expected xlsx.utils.sheet_to_json() to return a JSON' +
					' object.'
			);
		}

		// Register custom validation rules
		Validator.register(
			'phoneNumber',
			(value: string) => {
				return !!String(value).match(
					/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/
				);
			},
			'No valid phone number was received'
		);
		Validator.register('string', (value: string) => {
			return !!String(value).trim();
		});
		const rules = {
			name: ['string', 'fullName'],
			gender: ['string', {in: ['m', 'M', 'f', 'F', 'male', 'Male', 'female', 'Female']}],
			indexNo: ['string', 'required'],
			parentId: 'string|required',
			parentTel: 'string|required',
			requestedBy: 'string',
			adm: 'required|string'
		};
		let validatedLearners = requestingLearners.map(x => {
			let v = new Validator(x, rules);
			if (v.check()) return x;
			return {...x, validationErrors: v.errors.all()};
		});
		let validationError = validatedLearners.filter(x => x.validationErrors);
		if (validationError.length > 0) {
			throw {
				message: 'ValidationError',
				cause: validationError
			};
		}

		return validatedLearners.map(x => {
			return {
				indexNo: String(x['indexNo']),
				parent: {id: String(x['parentId']), tel: String(x['parentTel'])},
				requestedBy: x['requestedBy'] ? String(x['requestedBy']) : undefined,
				adm: String(x['adm'])
			};
		});
	} catch (err) {
		throw err;
	}
}
