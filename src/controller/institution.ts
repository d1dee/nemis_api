/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose from "mongoose";
import institutionModel from "@database/institution";
import tokenModel from "@database/token";
import learner from "@database/learner";
import CustomError from "@libs/error_handler";

const archiveInstitution = async (
    institutionId: mongoose.Types.ObjectId,
    tokenId: mongoose.Types.ObjectId
) => {
    try {
        if (mongoose.isValidObjectId(institutionId) && mongoose.isValidObjectId(tokenId)) {
            return await Promise.all([
                institutionModel.findByIdAndUpdate(institutionId, {
                    token: null,
                    $push: { archivedTokens: tokenId },
                    isArchived: true
                }),
                tokenModel.findByIdAndUpdate(tokenId, {
                    archived: true,
                    revoked: {
                        on: Date.now(),
                        by: institutionId,
                        reason: 'institution was deleted'
                    }
                }),
                learner.updateMany(
                    { institutionId: institutionId },
                    { archived: true },
                    { returnDocument: 'after' }
                )
            ]);
        }
        throw new CustomError("Provided _id's aren't valid mongoose _ids ");
    } catch (err) {
        throw err;
    }
};

export { archiveInstitution };
