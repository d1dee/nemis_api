/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { Request } from 'express';
import CustomError from '@libs/error_handler';
import { usernamePasswordSchema } from '@libs/zod_validation';
import { sendErrorMessage } from '../utils/middleware_error_handler';
import NemisWebService from '@libs/nemis';
import { validateUsernamePassword } from '../utils/query_params';
import { archiver } from '@libs/converts';

const getInstitution = (req: Request) => {
    try {
        if (!req.token || !req.institution)
            throw new CustomError('Something went terribly wrong. Please contact the administrator', 500);

        return req.respond.sendResponse({ ...req.institution.toObject(), currentToken: req.token });
    } catch (err: any) {
        //Handle errors here and return a response
        console.error(err);
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
        await nemis.login(username, password);

        let token = req.token;
        let institution = req.institution;

        let nemisData = await nemis.getInstitution(username);
        const update = {
            username: username,
            password: password,
            nemisInstitutionData: nemisData
        };
        // If username and password are the same, avoid updating the database
        let { acknowledged } = await institution.updateOne(update).exec();

        if (!acknowledged) throw new CustomError('Unable to update institution', 400);

        req.respond.sendResponse(
            {
                ...institution.toObject(),
                ...update,
                currentToken: req.token.toObject()
            },
            'Institution data was successfully updated'
        );
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

const deleteInstitution = async (req: Request) => {
    try {
        // Validate username and password before proceeding
        await validateUsernamePassword(req.body);

        let archive = archiver(JSON.stringify(req.query.reason ?? 'No reason provided'));

        await Promise.allSettled([
            req.institution
                .updateOne({
                    archived: archive
                })
                .exec(),
            req.token.updateOne({ archive: archive }).exec()
        ]);

        console.warn(
            `Received deletion request from ${req.institution?.username}, ${req.institution.nemisInstitutionData?.name}`
        );

        req.respond.sendResponse(
            {
                ...req.institution.toObject(),
                archived: archive,
                currentToken: { ...req.token.toObject(), archive: archive }
            },
            'Institution deleted'
        );
    } catch (err: any) {
        sendErrorMessage(req, err);
    }
};

export { deleteInstitution, getInstitution, updateInstitution };
