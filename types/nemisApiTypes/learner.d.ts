/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { InferSchemaType } from "mongoose";
import { learnerSchema } from "@database/learner";
import ApiHandler from "@libs/nemis/api_handler";
import { ParseReturnType } from "zod";
import LearnerHandler from "@libs/nemis/learner_handler";

// Learner as returned by the database.
export type Learner = InferSchemaType<typeof learnerSchema>;

export type Results = Awaited<ReturnType<ApiHandler['results']>>;
export type Admission = Awaited<ReturnType<ApiHandler['admission']>>;
export type ReportedCaptured = Awaited<ParseReturnType<ApiHandler['reportedCaptured']>>;

/**
 * Learner returned by http://nemis.education.go.ke/Learner/Listlearners.aspx on the NEMIS website
 */
export type ListLearners = Awaited<ParseReturnType<LearnerHandler['listLearners']>>;
export type ApprovedJoiningLeaner = Awaited<ParseReturnType<LearnerHandler['getApprovedJoiningLearners']>>;
