/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { accessSync, constants } from "fs";
import { readFile, utils } from "xlsx";
import CustomError from "./error_handler";

// Convert an Excel file to json and sanitize its data
const validateExcel = (filePath: string) => {
    try {
        accessSync(filePath, constants.R_OK);
        let workBook = readFile(filePath, { dateNF: 'yyyy-mm-dd', UTC: true, cellDates: true });
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

        return sheetData;
    } catch (err: any) {
        throw err;
    }
};

export { validateExcel };
