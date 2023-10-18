/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { NextFunction, Request, Response } from "express";
import { decode, JsonWebTokenError, TokenExpiredError, verify } from "jsonwebtoken";
import mongoose from "mongoose";
import institution_schema from "@database/institution";
import tokenSchema from "@database/token";
import logger from "@libs/logger";
import CustomError from "@libs/error_handler";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { DatabaseInstitution } from "types/nemisApiTypes";

// todo replace with passport
export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        // If a path is /api/auth/register , skip auth middleware
        if (['/api/auth/register', '/api/auth/recover'].includes(req.path) || !/^\/api\//.test(req.path)) {
            logger.debug('Skipping auth middleware');
            logger.info('Path is ' + req.path);
            return next();
        }

        const authMethod = <string | undefined>req.headers?.authorization?.split(' ')[0];
        const token = <string | undefined>req.headers?.authorization?.split(' ')[1];

        if (!authMethod || authMethod != 'Bearer' || !token) {
            throw new CustomError('Forbidden. Invalid auth method or token. Token must be if type Bearer', 403);
        }

        logger.info('Token received, verifying');
        logger.debug('Token: ' + token);

        if (!token) {
            throw new CustomError('Forbidden, token is undefined. An empty token was received.', 403);
        }

        // Get token value to check if it's revoked
        let decodedToken = decode(token);

        if (!decodedToken || typeof decodedToken === 'string' || !mongoose.isValidObjectId(decodedToken?.id)) {
            throw new CustomError('Forbidden. Invalid token. Token does not contain an id or id is not a valid mongoose _id', 403);
        }

        let tokenFromDb = await tokenSchema.findById(decodedToken.id);

        if (!tokenFromDb) {
            throw new CustomError('Forbidden, invalid token.', 403);
        }

        switch (true) {
            case tokenFromDb.archived:
                throw new CustomError('Forbidden. This token is archived. Register for a  new token at `/auth/register`', 403);

            case tokenFromDb.revoked === undefined:
                throw new CustomError('Forbidden. This token is revoked. Register for a  new token at `/auth/register`', 403);

            case !tokenFromDb.tokenSecret:
                logger.warn('Token secret is missing');
                throw new CustomError('Token secret is missing.', 500, 'internal_server_error');

            case Date.parse(tokenFromDb.expires.toString()) < Date.now():
                logger.debug('Token has expired');
                throw new CustomError('Forbidden. Token has expired, please refresh', 403);
        }

        if (req.path === '/api/auth/refresh') {
            logger.debug('Token refresh');

            req.token = tokenFromDb.toObject();

            req.decodedToken = decodedToken;

            return next();
        }

        //Verify the token
        let verifiedToken = verify(token, tokenFromDb.tokenSecret);

        if (!verifiedToken || typeof verifiedToken === 'string') {
            throw new CustomError('Forbidden. Invalid token. Token must be of type Bearer', 403);
        }

        logger.debug('Token verifiedToken');
        logger.debug('Token: ' + JSON.stringify(verifiedToken));

        // Find an institution in the token
        let institution = await institution_schema.findById(tokenFromDb?.institutionId);

        if (!institution) {
            throw new CustomError(`Institution not found Institution with id ${tokenFromDb?.institutionId?.toString()} not found.`, 404);
        }

        req.institution = <DatabaseInstitution>institution?.toObject();
        req.token = tokenFromDb;
        req.isValidToken = true;

        return next();
    } catch (err: any) {
        if (err instanceof TokenExpiredError) {
            logger.warn(err.message);
            err = { code: 403, message: 'Forbidden. Token expired', cause: err.message };
        }
        if (err instanceof JsonWebTokenError || err instanceof SyntaxError) {
            logger.warn(err.message);
            err = { code: 403, message: 'Forbidden. Invalid token', cause: err.message };
        }
        if (!err) {
            logger.error(err);
            err = { code: 500, message: 'Internal Server Error', cause: err.message };
        }
        sendErrorMessage(req, err);
    }
};
