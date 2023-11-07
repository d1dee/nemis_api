/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from "express";
import NemisApiService from "@libs/nemis/api_handler";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import CustomError from "@libs/error_handler";

export default async (req: Request) => {
    try {
        if (!req?.params?.uniqueIdentifier) {
            throw new CustomError(
                'Expected learners upi or birth certificate number as a query parameter. Learners birth certificate number or upi was not provided',
                400
            );
        }

        let searchResults = await new NemisApiService().searchLearner(req.params.uniqueIdentifier);

        return req.respond.sendResponse(searchResults, 'Query was successful.');
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};
