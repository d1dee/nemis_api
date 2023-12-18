/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { NextFunction, Request, Response } from "express";
import CustomError from "@libs/error_handler";
import { sendErrorMessage } from "./middleware_error_handler";

export default (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.files || (typeof req.files === "object" && Object.keys(req.files).length < 1))
            throw new CustomError(
                "Invalid request. No file received or unsupported file type.Please upload an Excel file using multi-part upload.",
                400
            );
        
        if (Object.keys(req.files).length > 1)
            throw new CustomError(
                "Invalid request. Only one file per upload is allowed." +
                "Please upload only one file at a time.",
                400
            );
        
        // Select the first file in the req.files object
        const file = req.files[Object.keys(req.files)[0]];
        
        if (Array.isArray(file)) {
            throw new CustomError(
                "Invalid request. The uploaded file is not valid." +
                "Expected an object, but received an array instead.",
                400
            );
        }
        
        // Verify if file mimetype corresponds to Excels mimetype
        if (
            ![
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ].includes(file.mimetype)
        ) {
            throw new CustomError(
                "Invalid file format. Please upload an Excel file with the extension '.xls' or '.xlsx'." +
                "Received file with mimetype '${file.mimetype}' which is not supported.",
                400
            );
        }
        
        if (file.size > 1e7) {
            throw new CustomError(
                "File size exceeds the limit. The uploaded file is too large." +
                "Please upload a file that is less than 10MB in size.",
                413
            );
        }
        
        if (
            [
                "application/vnd.ms-excel.sheet.macroEnabled.12",
                "application/vnd.ms-excel.template.macroEnabled.12",
                "application/vnd.ms-excel.addin.macroEnabled.12",
                "application/vnd.ms-excel.sheet.binary.macroEnabled.12"
            ].includes(file.mimetype)
        ) {
            throw new CustomError(
                "Invalid file format. Excel files containing macros are not supported." +
                "Received file with a macro, which is not allowed.",
                400
            );
        }
        
        // Move files to institutions specific folder
        let path =
            process.cwd() +
            `/uploads/${req.institution.username}/${file.name.replaceAll(
                /[\/\\]/g,
                "_"
            )}_${new Date().toDateString()}`.replaceAll(" ", "_");
        
        file.mv(path, err => {
            if (err) {
                throw new CustomError("Error while saving file.", 500, err);
            } else {
                req.body.file = path;
                next();
            }
        });
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};
