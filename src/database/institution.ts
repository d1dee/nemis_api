/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import * as mongoose from "mongoose";
import { GRADES } from "@libs/zod_validation";

import {
	EDUCATION_SYSTEM,
	INSTITUTION_ACCOMMODATION_TYPE,
	INSTITUTION_CATEGORY,
	INSTITUTION_GENDER,
	INSTITUTION_LEVEL,
	INSTITUTION_MOBILITY_TYPE,
	INSTITUTION_OWNER_TYPE,
	INSTITUTION_REGISTRATION_STATUS,
	INSTITUTION_RESIDENCE,
	OWNERSHIP_DOCUMENT_TYPE
} from "@libs/nemis/validations";
import { decryptString, encryptString } from "@libs/crypt";

export default mongoose.model(
  "institution",
  new mongoose.Schema({
    // User passed username and password during registration
    username: {
      type: String,
      required: true,
      index: {
        unique: true,
        partialFilterExpression: { username: { $exists: true, $type: "string" } }
      }
    },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now() },
    lastLogin: { type: Date, default: Date.now() },
    // Current token
    token: {
      index: true,
      type: mongoose.Schema.Types.ObjectId,
      ref: "token"
    },
    // Ids of all previous tokens
    archivedTokens: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "token"
      }
    ],
    // Populated form http://nemis.education.go.ke/Institution/Institution.aspx
    name: { type: String, index: true },
    code: { type: String, index: true },
    gender: {
      type: String,
      enum: INSTITUTION_GENDER
    },
    supportedGrades: [
      {
        required: true,
        type: String,
        enum: GRADES,
        index: true
      }
    ],
    knecCode: String,
    type: String,
    registrationNumber: String,
    cluster: String,
    accommodation: {
      type: String,
      enum: INSTITUTION_ACCOMMODATION_TYPE
    },
    constituency: String,
    zone: String,
    ward: String,
    kraPin: String,
    plusCode: String,
    registrationStatus: {
      type: String,
      enum: INSTITUTION_REGISTRATION_STATUS
    },
    tscCode: String,
    category: {
      type: String,
      enum: INSTITUTION_CATEGORY
    },
    educationLevel: {
      description: {
        type: String,
        enum: INSTITUTION_LEVEL
      },
      code: Number
    },
    institutionMobility: {
      type: String,
      enum: INSTITUTION_MOBILITY_TYPE
    },
    residence: {
      type: String,
      enum: INSTITUTION_RESIDENCE
    },
    educationSystem: {
      type: String,
      enum: EDUCATION_SYSTEM
    },
    registrationDate: String,
    county: String,
    subCounty: String,
    ownership: {
      type: String,
      enum: INSTITUTION_OWNER_TYPE
    },
    ownershipDocument: {
      type: String,
      enum: OWNERSHIP_DOCUMENT_TYPE
    },
    owner: String,
    incorporationCertificateNumber: String,
    nearestPoliceStation: String,
    nearestHealthFacility: String,
    nearestTown: String,
    postalAddress: String,
    telephoneNumber: String,
    mobileNumber: String,
    altTelephoneNumber: String,
    altMobileNumber: String,
    email: String,
    website: String,
    socialMediaHandles: String,
    isArchived: { type: Boolean, default: false },
    archivedOn: Date
  })
    .pre("save", function(next) {
      // Encrypt password before saving
      this.password = encryptString(this.password);
      return next();
    })
    .post("findOne", function(doc, next) {
      if (doc) {
        // Decrypt password before returning doc
        doc.password = decryptString(doc.password);
      }
      next();
    })
);
