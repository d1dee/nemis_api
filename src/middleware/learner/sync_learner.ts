/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { sync } from "@libs/sync_api_database";
import { Request } from "express";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";

const syncLearnerDatabase = async (req: Request) => {
    try {
        req.sendResponse.respond(
            undefined,
            'Database sync has been initiated. This might take a while, depending on how responsive the Nemis website is. '
        );
        await sync(req.institution);
    } catch (err) {
        sendErrorMessage(req, err);
    }
};

export { syncLearnerDatabase };
