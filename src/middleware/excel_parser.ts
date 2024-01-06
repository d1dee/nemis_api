/*
 * Copyright (c) 2024. MIT License. Maina Derrick.
 */
import { NextFunction, Request, Response } from "express";
import { accessSync, constants } from "fs";
import { readFile, utils } from "xlsx";
import CustomError from "@libs/error_handler";

export default function(req: Request, _: Response, next: NextFunction) {
    try {
        // Convert an Excel file to json and attach returned data req.excel
        
        // @todo add sample excel file
        if (!req?.body?.file) throw new CustomError("This path expects an excel file.", 400);
        
        const filePath = req.body.file;
        
        // Check if we can access file
        accessSync(filePath, constants.R_OK);
        
        let workBook = readFile(filePath, { dateNF: "yyyy-mm-dd", UTC: true, cellDates: true });
        
        if (workBook.SheetNames.length < 1) {
            throw new CustomError(
                "Invalid file format. No sheets with data were found." +
                "The workbook should have at least one sheet containing learner data.",
                400
            );
        }
        
        if (workBook.SheetNames.length > 1) {
            throw new CustomError(
                "Invalid file format. More than one sheet was found." +
                "Please remove all unnecessary sheets and upload a file with only one sheet containing learner data.",
                400
            );
        }
        
        // Parse sheetData
        const sheetData = utils.sheet_to_json(workBook.Sheets[workBook.SheetNames[0]]);
        
        // Check if workbook has data in it
        if (!Array.isArray(sheetData) || sheetData.length === 0)
            throw new CustomError(
                `Failed to convert sheet data.
             The worksheet \'${workBook.SheetNames[0]}\' may not contain any data or the data could not be processed. 
             xlsx.utils.sheet_to_json did not return an array or returned an empty array.`,
                400
            );
        
        req.parsedExcel = sheetData;
        next();
    } catch (err: any) {
        console.error(err);
        req.respond.sendError(err.code ?? 500, err.message, err);
    }
    
}