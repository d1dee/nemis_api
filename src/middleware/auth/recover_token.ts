/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import CustomError from "@libs/error_handler";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { Request } from "express";
import { validateUsernamePassword } from "@middleware/utils/query_params";
import tokenModel from "@database/token";

export default async (req: Request) => {
    try {
        const institution = await validateUsernamePassword(req.body);

        let tokenId = institution.token.currentToken;
        if (!tokenId)
            throw new CustomError('Institution has no linked token, please register institution again.', 500);

        const token = await tokenModel.findById(tokenId);

        if (!token) {
            console.error(new Error('tokenId is null'));
            throw new CustomError('Unknown error while trying to retrieve token from database.', 500);
        }

        if (institution.archived?.isArchived && token.expires.UTCTimestamp.getTime() < Date.now()) {
            throw new CustomError(
                `Institution data was deleted from the local database with message: ${institution.archived?.reason}. Please register to get a new token `
            );
        }

        req.token = token;

        // Send token saved in Database
        req.respond.sendResponse(
            { ...institution.toObject(), token: token },
            token.expires.UTCTimestamp.getTime() < Date.now()
                ? 'The recovered token has already expired. Use `/auth/refresh` to get a new token'
                : 'Token recovered successfully.'
        );
    } catch (error: any) {
        console.error(JSON.stringify(error));
        sendErrorMessage(req, error);
    }
};
