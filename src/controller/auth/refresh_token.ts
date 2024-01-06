/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { Request } from "express";
import { sendErrorMessage } from "../utils/middleware_error_handler";
import JWT from "@libs/JWT";

export default async (req: Request) => {
    try {
        let { reason } = req.query;

        let [token, institution] = await new JWT().refreshToken(
            req.token.institutionId,
            req.token._id,
            typeof reason === 'string' ? reason : JSON.stringify(reason ?? 'User requested refresh.')
        );

        req.respond.sendResponse({ ...institution.toObject(), token: token }, 'Token refreshed.');
    } catch (err: any) {
        console.error(err);
        sendErrorMessage(req, err);
    }
};
