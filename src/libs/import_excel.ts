/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { accessSync, constants } from "fs";
import { readFile, utils, WorkBook } from "xlsx";
import { z as zod } from "zod";
import { lowerCaseAllValues } from "./converts";
import { completeLearnerSchema } from "./zod_validation";
import CustomError from "./error_handler";

// Convert an Excel file to json and sanitize its data
const validateExcel = (filePath: string) => {
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
 Validates a learner object based on a Zod schema and applies additional custom validation logic.
 Returns a Learner object if the validation is successful,
 or a Learner object with a validation error property if the validation fails.
 */

const validateLearnerJson = (obj: any) => {
    try {
        completeLearnerSchema.superRefine((value, ctx) => {
            if (
                value.birthCertificateNo &&
                value.birthCertificateNo.length < 7 &&
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

        let validatedObject = completeLearnerSchema.safeParse({
            ...obj,
            dob: obj.dob,
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
        });

        if (validatedObject.success) {
            return validatedObject.data;
        } else {
            return Object.assign(obj, {
                validationError: validatedObject.error.flatten().fieldErrors
            });
        }
    } catch (err: any) {
        throw err;
    }
};

export { validateExcel, validateLearnerJson };
