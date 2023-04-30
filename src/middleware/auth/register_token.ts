/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from "express";
import { newInstitutionSchema } from "../../libs/zod_validation";
import { registerInstitution } from "../../controller/institution";
import { sendErrorMessage } from "../utils/middlewareErrorHandler";

export default async (req: Request) => {
    try {

        let registrationObject = await registerInstitution((await newInstitutionSchema.parseAsync(req.body)));

        return req.sendResponse.respond(
            registrationObject,
            "Institution registered successfully.",
            201
        );
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};
