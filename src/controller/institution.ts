/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose from "mongoose";
import institutionModel from "@database/institution";
import tokenModel from "@database/token";
import CustomError from "@libs/error_handler";
import { Institution } from "types/nemisApiTypes";
import learner from "@database/learner";
import { NemisWebService } from "@libs/nemis/nemis_web_handler";

type ArchiveInstitution = (institutionId: mongoose.Types.ObjectId, tokenId: mongoose.Types.ObjectId) => Promise<boolean>;
type UpdateInstitution = (
    username: string,
    password: string,
    institutionId: string
) => Promise<Institution & { username: string; password: string; cookie: { value: string; expires: number } }>;
type __GetInstitution = (
    username: string,
    password: string
) => Promise<
    Institution & {
        username: string;
        password: string;
        cookie: { value: string; expires: number };
    }
>;

const __getInst: __GetInstitution = async (username, password) => {
    try {
        const nemis = new NemisWebService();
        const cookie = await nemis.login(username, password);

        let institution = await nemis.getInstitution(username);
        if (!institution || typeof institution !== 'object') {
            throw new CustomError('No valid institution information was returned, check your credentials and try again', 401, 'Unauthorized');
        }
        return {
            ...institution,
            username: username,
            password: password,
            cookie: { value: cookie, expires: Date.now() + 3.6e6 }
        };
    } catch (err) {
        throw err;
    }
};

const updateInstitution: UpdateInstitution = async (username, password, institutionId) => {
    try {
        let institution = await __getInst(username, password);
        await institutionModel.findByIdAndUpdate(institutionId, institution).lean();
        if (!institution) {
            throw new Error('Institution not updated, Invalid institution info');
        } else {
            return institution;
        }
    } catch (err) {
        throw err;
    }
};

const archiveInstitution: ArchiveInstitution = async (institutionId, tokenId) => {
    try {
        if (mongoose.isValidObjectId(institutionId) && mongoose.isValidObjectId(tokenId)) {
            await Promise.all([
                institutionModel.findByIdAndUpdate(institutionId, {
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
                learner.updateMany({ institutionId: institutionId }, { archived: true })
            ]);
            return true;
        } else {
            return false;
        }
    } catch (err) {
        throw err;
    }
};

export { updateInstitution, archiveInstitution };
