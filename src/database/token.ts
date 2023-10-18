/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import * as mongoose from "mongoose";

export default mongoose.model(
    "token",
    new mongoose.Schema({
        token: { type: String },
        // A random string that is used to verify the token
        tokenSecret: { type: String, required: true },
        // Creation date of token
        createdAt: {
            type: Date,
            default: Date.now(),
            required: true
        },
        // Expiry date of token
        expires: {
            type: Date,
            default: Date.now() + 2.592e9,
            required: true
        },
        // Institution associated with this token
        institutionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "institution",
            required: true
        },
        // Reason for the token to be revoked (e.g. user logged out)
        revoked: {
            on: {
                type: Date
            },
            by: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "institution"
            },
            reason: String
        },
        // true when the associated institution is archived
        archived: {
            type: Boolean,
            default: false,
            required: true
        }
    })
);