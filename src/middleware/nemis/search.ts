/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from "express";

export default async (req: Request) => {
    try {
        if (!req?.params?.uniqueIdentifier) {
            throw{
                code: 400,
                message: "Expected learners upi or birth certificate number as a query parameter.",
                cause: "Learners birth certificate number or upi was not provided"
            };
        }

        let searchResults = await req.nemis.searchLearner(req.params.uniqueIdentifier);

        return req.sendResponse.respond(
            searchResults,
            "Query was successful."
        );
    } catch (err: any) {
        req.sendResponse.error(
            err.code || 500,
            err.message || "Internal server error",
            err.cause || ""
        );
    }
};
