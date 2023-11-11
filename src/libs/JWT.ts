/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import * as jwt from "jsonwebtoken";
import { decode, verify } from "jsonwebtoken";
import { randomFillSync } from "node:crypto";
import mongoose from "mongoose";
import tokenModel from "@database/token";
import ms from "ms";
import institutionModel from "@database/institution";
import { dateTime } from "@libs/converts";
import CustomError from "@libs/error_handler";

export default class {
    private bearerToken: string | undefined;

    constructor(token?: string) {
        this.bearerToken = token;
    }

    async decodeToken(bearerToken: string, path: string) {
        try {
            // Get token value to check if it's revoked
            let token = decode(bearerToken);
            if (!token || typeof token === 'string') {
                console.error('Decode token is null');
                throw new CustomError('Failed to decode token', 400);
            }
            const databaseToken = await tokenModel.findOne({ token: bearerToken });

            if (!databaseToken) {
                console.error('Bearer token not found in the database');
                throw new CustomError('Token not found in the database.', 500);
            }
            if (databaseToken.archive?.isArchived) {
                console.warn('Token is archived');
                throw new CustomError(
                    `Token was archived ${
                        databaseToken.archive?.reason ? `with reason: ${databaseToken.archive?.reason}` : ''
                    }`,
                    403
                );
            }
            if (!databaseToken.tokenSecret) {
                console.warn('Token secret is missing');
                throw new CustomError('Token secret is missing.', 500);
            }

            // Ignore expiration if path is /auth/refresh
            if (
                !verify(bearerToken, databaseToken.tokenSecret, {
                    ignoreExpiration: path === '/api/auth/refresh'
                })
            ) {
                console.error('Token could not be verified');
                throw new CustomError('Received an invalid token ', 400);
            }

            return databaseToken;
        } catch (err: any) {
            throw err;
        }
    }

    // Used to generate a new bearer token
    async getNewToken(_id: mongoose.Types.ObjectId, institutionId: mongoose.Types.ObjectId) {
        // Generate a token secret
        let tokenSecret = randomFillSync(Buffer.alloc(32)).toString('hex');
        let token = jwt.sign(
            {
                tokenId: _id.toString(),
                institutionId: institutionId.toString()
            },
            tokenSecret,
            { expiresIn: '30 d' }
        );
        return await tokenModel.create({
            _id: _id,
            token: token,
            tokenSecret: tokenSecret,
            institutionId: institutionId,
            expires: dateTime(new Date(Date.now() + ms('30 d')))
        });
    }

    // Refresh bearer token
    async refreshToken(
        institutionId: mongoose.Types.ObjectId,
        previousTokenId: mongoose.Types.ObjectId,
        reason: string
    ) {
        try {
            let newTokenId = new mongoose.Types.ObjectId();

            // Get new token
            const newTokenObject = await this.getNewToken(newTokenId, institutionId);

            // Run database updates in parallel
            const [updatedInstitution] = await Promise.all([
                institutionModel.findByIdAndUpdate(institutionId, {
                    $push: { 'token.archivedTokens': previousTokenId },
                    'token.currentToken': newTokenObject._id
                }),
                tokenModel.findByIdAndUpdate(previousTokenId, {
                    'archive.isArchived': true,
                    'archive.archivedOn': dateTime(),
                    'archive.reason': reason
                })
            ]);

            return [newTokenObject, updatedInstitution!];
        } catch (error) {
            throw error;
        }
    }
}
