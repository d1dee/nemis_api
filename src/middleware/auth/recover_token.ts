/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import CustomError from "@libs/error_handler";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { Request } from "express";
import { DatabaseToken } from "types/nemisApiTypes";
import { validateUsernamePassword } from "@middleware/utils/query_params";

export default async (req: Request) => {
    try {
        const institution = await validateUsernamePassword(req.body);

        let token = (await institution.populate('token')).token as DatabaseToken | undefined;

        if (institution.isArchived || token?.archived) {
            throw new CustomError(
                'Institution data was deleted from the local database. Use register to get a new token '
            );
        }
        if (!token) throw new CustomError('No valid token associated with the institution.', 400);
        // Send token saved in Database
        req.sendResponse.respond(
            institution,
            token.expires.getTime() < Date.now()
                ? 'The recovered token has already expired. Use `/auth/refresh` to get a new token'
                : 'Token recovered successfully.'
        );
    } catch (error: any) {
        console.error(JSON.stringify(error));
        sendErrorMessage(req, error);
    }
};
