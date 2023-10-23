/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from "express";
import { newInstitutionSchema } from "@libs/zod_validation";
import { sendErrorMessage } from "../utils/middleware_error_handler";
import institutionModel from "@database/institution";
import { NemisWebService } from "@libs/nemis/nemis_web_handler";
import JWT from "@libs/JWT";
import mongoose from "mongoose";
import { DatabaseInstitution } from "../../../types/nemisApiTypes";

export default async (req: Request) => {
    try {
        const { username, password, previousRegistration } = await newInstitutionSchema.parseAsync(
            req.body
        );

        const nemis = new NemisWebService();

        await nemis.login(username, password);
        // Get institution details from NEMIS
        let institution = await nemis.getInstitution(username);

        // Create a token _id
        let tokenId = new mongoose.Types.ObjectId();
        let institutionId = new mongoose.Types.ObjectId();

        // Create a new token in database
        const tokenObject = await new JWT().getNewToken(
            tokenId,
            previousRegistration ? previousRegistration._id : institutionId
        );

        // Find institution and create if institution doesn't exist using {upsert:true}
        let institutionDocument = previousRegistration
            ? ((await institutionModel.findByIdAndUpdate(previousRegistration._id, {
                  isArchived: false,
                  token: tokenId,
                  username: username,
                  password: password
              })) as DatabaseInstitution)
            : await institutionModel.create({
                  _id: institutionId,
                  ...institution,
                  username: username,
                  password: password,
                  isArchived: false,
                  token: tokenId
              });

        return req.sendResponse.respond(
            Object.assign(institutionDocument.toObject(), { token: tokenObject }),
            'Institution registered successfully.',
            201
        );
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};
