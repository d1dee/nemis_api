/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import * as jwt from "jsonwebtoken";
import { decode } from "jsonwebtoken";
import { randomFillSync } from "node:crypto";
import mongoose from "mongoose";
import tokenModel from "@database/token";
import ms from "ms";
import { DatabaseInstitution, DatabaseToken } from "../../types/nemisApiTypes";
import institutionModel from "@database/institution";

export default class {
    constructor(token?: string) {
        if (token) decode(token);
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
        let document = await tokenModel.create({
            _id: _id,
            token: token,
            tokenSecret: tokenSecret,
            institutionId: institutionId,
            expires: Date.now() + ms('30 d')
        });
        return document.toObject() as DatabaseToken;
    }

    // Refresh bearer token
    async refreshToken(
        institutionId: mongoose.Types.ObjectId,
        previousTokenId: mongoose.Types.ObjectId
    ) {
        try {
            let newTokenId = new mongoose.Types.ObjectId();

            // Get new token
            const newTokenObject = await this.getNewToken(newTokenId, institutionId);

            // Run database updates in parallel
            const [_, updatedInstitution] = await Promise.all([
                tokenModel.findByIdAndUpdate(previousTokenId, {
                    archived: true,
                    archivedReason: 'Token has expired'
                }),
                institutionModel.findByIdAndUpdate(institutionId, {
                    $push: { archivedTokens: previousTokenId },
                    token: newTokenObject._id
                })
            ]);

            return [updatedInstitution?.toObject() as DatabaseInstitution, newTokenObject];
        } catch (error) {
            throw error;
        }
    }
}
