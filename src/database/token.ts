/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import * as mongoose from "mongoose";
import { archiveSchema, dateTimeSchema } from "@database/index";
import { dateTime } from "@libs/converts";

export const tokenSchema = new mongoose.Schema({
    token: { type: String },
    // A random string that is used JWT to encrypt the token
    tokenSecret: { type: String, required: true },
    // Creation date of token
    createdAt: {
        type: dateTimeSchema,
        default: dateTime(),
        required: true
    },
    // Expiry date of token
    expires: {
        type: dateTimeSchema,
        required: true
    },
    // Institution associated with this token
    institutionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'institution',
        required: true
    },
    // Reason for the token to be revoked (e.g. user logged out)
    revoked: {
        on: {
            type: dateTimeSchema
        },
        by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'institution'
        },
        reason: String
    },
    // true when the associated institution is archived
    archive: archiveSchema
});

export default mongoose.model('token', tokenSchema);
