/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from "express";
import { archiveInstitution, updateInstitution as updateInstitutionController } from "@controller/institution";
import logger from "@libs/logger";
import CustomError from "@libs/error_handler";
import { usernamePasswordSchema } from "@libs/zod_validation";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { NemisWebService } from "@libs/nemis/nemis_web_handler";
import { validateUsernamePassword } from "@middleware/utils/query_params";
import { DatabaseInstitution, DatabaseToken } from "types/nemisApiTypes";

const getInstitution = (req: Request) => {
    const response = req.sendResponse;
    try {
        let institution = req.institution;
        let token = req.token;

        if (!token || !institution) throw new CustomError('Something went terribly wrong. Please contact the administrator', 500);

        let institutionObject = Object.assign(institution.toObject(), {
            token: token.token,
            tokenCreatedAt: token.createdAt,
            tokenExpiresAt: token.expires
        });

        return response.respond({
            ...institutionObject,
            token: token.token,
            expires: token.expires,
            created: token.createdAt
        });
    } catch (err: any) {
        //Handle errors here and return a response
        logger.error(err);
        sendErrorMessage(req, err);
    }
};

const updateInstitution = async (req: Request) => {
    try {
        const body = await usernamePasswordSchema.parseAsync(req.body);

        if (body.username !== req.institution.username)
            throw new CustomError('Unable to update username. Please create a new account instead.', 405, 'method_not_allowed');

        const nemis = new NemisWebService();
        let cookie = await nemis.login(body.username, body.password);

        if (!cookie) {
            throw new CustomError('Invalid username or password', 401, 'invalid_credentials');
        }
        let token = req.token?.toObject();
        if (!token || !Object.hasOwn(token, 'institutionId')) {
            throw new CustomError('Unable to update institution', 400);
        }

        // If username and password are the same, avoid updating the database
        let updatedInstitution;
        if (body.username === req.institution.username && body.password === req.institution.password) {
            updatedInstitution = req.institution;
        } else {
            updatedInstitution = await updateInstitutionController(body.username, body.password, token.institutionId.toString());
        }

        if (!updatedInstitution) {
            throw new CustomError('Unable to update institution', 400);
        } else {
            return req.sendResponse.respond(updatedInstitution);
        }
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

const deleteInstitution = async (req: Request) => {
    try {
        // Validate username and password before proceeding
        await validateUsernamePassword(req.body);

        let token = req.token?.toObject() as DatabaseToken;
        if (!token || !Object.hasOwn(token, '_id') || !Object.hasOwn(token, 'institutionId'))
            throw new CustomError('Supplied token is not associated with any institution', 400);

        let isArchive = await archiveInstitution(token.institutionId, token._id);
        if (!isArchive) {
            throw {
                code: 400,
                message: 'Unable to delete institution',
                cause: 'Institution not found'
            };
        } else {
            const institution = req.institution.toObject() as DatabaseInstitution;

            Object.assign(institution, token);

            console.warn(`Received deletion request from ${institution?.username}, ${institution.name}`);

            req.sendResponse.respond(institution, 'Institution deleted');
        }
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

export { deleteInstitution, getInstitution, updateInstitution };
