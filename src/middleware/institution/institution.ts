/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from "express";
import { archiveInstitution } from "@controller/institution";
import logger from "@libs/logger";
import CustomError from "@libs/error_handler";
import { usernamePasswordSchema } from "@libs/zod_validation";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { NemisWebService } from "@libs/nemis/nemis_web_handler";
import { validateUsernamePassword } from "@middleware/utils/query_params";
import { DatabaseToken } from "types/nemisApiTypes";
import institutionModel from "@database/institution";

const getInstitution = (req: Request) => {
    const response = req.sendResponse;
    try {
        if (!req.token || !req.institution)
            throw new CustomError(
                'Something went terribly wrong. Please contact the administrator',
                500
            );

        let institutionObject = Object.assign(req.institution, { token: req.token });

        return response.respond(institutionObject);
    } catch (err: any) {
        //Handle errors here and return a response
        logger.error(err);
        sendErrorMessage(req, err);
    }
};

const updateInstitution = async (req: Request) => {
    try {
        const { username, password } = await usernamePasswordSchema.parseAsync(req.body);

        if (username !== req.institution.username)
            throw new CustomError(
                'Only username linked to the authorization token can be updated.',
                405,
                'method_not_allowed'
            );
        let nemis = new NemisWebService();
        let cookie = await nemis.login(username, password);

        if (!cookie) {
            throw new CustomError('Invalid username or password', 401, 'invalid_credentials');
        }

        let token = req.token;

        if (!token || !Object.hasOwn(token, 'institutionId')) {
            throw new CustomError('Unable to update institution', 400);
        }
        let institution = await nemis.getInstitution(username);

        // If username and password are the same, avoid updating the database
        let updatedInstitution =
            username === req.institution.username && password === req.institution.password
                ? req.institution
                : await institutionModel.findByIdAndUpdate(token.institutionId, {
                      username: username,
                      password: password,
                      ...institution
                  });

        if (!updatedInstitution) throw new CustomError('Unable to update institution', 400);

        req.sendResponse.respond(updatedInstitution, 'Institution data was successfully updated');
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

const deleteInstitution = async (req: Request) => {
    try {
        // Validate username and password before proceeding
        await validateUsernamePassword(req.body);

        let token = req.token as DatabaseToken;

        if (!token || !Object.hasOwn(token, '_id') || !Object.hasOwn(token, 'institutionId'))
            throw new CustomError('Supplied token is not associated with any institution', 400);

        let [archivedInstitution, archivedToken] = await archiveInstitution(
            token.institutionId,
            token._id
        );

        console.warn(
            `Received deletion request from ${req.institution?.username}, ${req.institution.name}`
        );

        req.sendResponse.respond(
            {
                ...archivedInstitution?.toObject(),
                token: archivedToken?.toObject()
            },
            'Institution deleted'
        );
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

export { deleteInstitution, getInstitution, updateInstitution };
