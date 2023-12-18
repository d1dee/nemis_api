/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from "express";
import { newInstitutionSchema } from "@libs/zod_validation";
import { sendErrorMessage } from "../utils/middleware_error_handler";
import institutionModel from "@database/institution";
import { NemisWebService } from "@libs/nemis";
import JWT from "@libs/JWT";
import mongoose from "mongoose";

export default async (req: Request) => {
    try {
        const { username, password, previousRegistration } = await newInstitutionSchema.parseAsync(req.body);

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
        let institutionDocument: any = {
            _id: institutionId,
            nemisInstitutionData: institution,
            username: username,
            password: password,
            isArchived: false,
            currentToken: tokenId
        };

        if (previousRegistration)
            institutionDocument = await institutionModel.findByIdAndUpdate(
                previousRegistration._id,
                {
                    archived: false,
                    currentToken: tokenId,
                    username: username,
                    password: password
                },
                { returnDocument: 'after' }
            );
        else institutionDocument = await institutionModel.create(institutionDocument);

        req.token = tokenObject;

        return req.respond.sendResponse(
            { ...institutionDocument.toObject(), currentToken: tokenObject },
            'Institution registered successfully.',
            201
        );
    } catch (err: any) {
        console.error(err);
        sendErrorMessage(req, err);
    }
};
