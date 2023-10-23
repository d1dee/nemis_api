/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import logger from "@libs/logger";
import { Request } from "express";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import JWT from "@libs/JWT";

export default async (req: Request) => {
    try {
        let [_, newTokenObject] = await new JWT().refreshToken(
            req.token.institutionId,
            req.token._id
        );

        req.sendResponse.respond(newTokenObject, 'Token refreshed.');
    } catch (err: any) {
        logger.error(err);
        sendErrorMessage(req, err);
    }
};
