/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { NextFunction, Request, Response } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import institutionModel from "@database/institution";
import CustomError from "@libs/error_handler";
import JWT from "@libs/JWT";
import { dateTime } from "@libs/converts";

// todo replace with passport
export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        // If a path is /api/auth/register , skip auth middleware
        if (
            ['/api/auth/register', '/api/auth/recover'].some(element => req.path.endsWith(element)) ||
            !/^\/api\//.test(req.path)
        ) {
            console.debug('Skipping auth middleware');
            console.info('Path is ' + req.path);
            return next();
        }

        const authMethod = <string | undefined>req.headers?.authorization?.split(' ')[0];
        const bearerToken = <string | undefined>req.headers?.authorization?.split(' ')[1];

        if (!authMethod || authMethod != 'Bearer' || !bearerToken) {
            throw new CustomError(
                'Forbidden. Invalid auth method or token. Token must be if type Bearer',
                403
            );
        }

        console.info('Token received, verifying');
        console.debug('Token: ' + bearerToken);

        if (!bearerToken) {
            throw new CustomError('Forbidden, token is undefined. An empty token was received.', 403);
        }

        const token = await new JWT().decodeToken(bearerToken, req.path);
        // Find an institution in the token
        let institution = await institutionModel.findByIdAndUpdate(
            token.institutionId,
            {
                'timeStamps.lastLogin': dateTime()
            },
            { returnDocument: 'after' }
        );

        if (!institution) {
            console.error(`There is no institution linked with the token: ${token}`);
            throw new CustomError(`There is no institution linked with the provided token.`, 404);
        }

        req.institution = institution;
        req.token = token;

        return next();
    } catch (err: any) {
        if (err instanceof TokenExpiredError) {
            err = { code: 403, message: 'Forbidden. Token expired', cause: err.message };
        }
        if (err instanceof JsonWebTokenError || err instanceof SyntaxError) {
            err = { code: 403, message: 'Forbidden. Invalid token', cause: err.message };
        }
        if (!err) {
            err = { code: 500, message: 'Internal Server Error', cause: err.message };
        }
        console.error(err);
        req.respond.sendError(err.code, err.message, err);
    }
};
