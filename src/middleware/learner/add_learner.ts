/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from "express";
import learnerModel from "@database/learner";
import { validateExcel, validateLearnerJson } from "@libs/import_excel";
import CustomError from "@libs/error_handler";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { lowerCaseAllValues } from "@libs/converts";

const addLearnerByFile = async (req: Request) => {
    try {
        // If for some reason the file path wasn't passed
        if (!Object.hasOwn(req.body, 'file')) {
            throw new CustomError(
                'Invalid request. No file was uploaded. Please upload an Excel file using multi-part upload.',
                400
            );
        }
        // Validate requested file
        await handleValidatedData(validateExcel(req.body.file), req);
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

const addLearnerByJson = async (req: Request) => {
    try {
        // Validate requested learner
        let validatedLearner = Array.isArray(req.body)
            ? req.body.map(learner => validateLearnerJson(lowerCaseAllValues(learner)))
            : [validateLearnerJson(lowerCaseAllValues(req.body))];

        await handleValidatedData(validatedLearner, req);
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

const handleValidatedData = async (validatedJson: any[], req: Request) => {
    let validationError = validatedJson.filter(x => !!x.validationError);
    if (validationError.length > 0) {
        throw new CustomError(
            'Validation error.' + 'One or more fields failed to validate. Please check the following errors',
            400,
            validationError
        );
    }

    let insertedDocs = await Promise.all(
        validatedJson.map(learner =>
            learnerModel.findOneAndUpdate(
                { adm: { $eq: learner.adm } },
                {
                    ...learner,
                    institutionId: req.institution._id,
                    continuing: learner.continuing ? learner.continuing : req.url.includes('continuing'),
                    archived: false
                },
                {
                    upsert: true,
                    returnDocument: 'after'
                }
            )
        )
    );
    req.respond.sendResponse(insertedDocs, `${insertedDocs.length} learners added to the database.`);
};

export { addLearnerByFile, addLearnerByJson };
