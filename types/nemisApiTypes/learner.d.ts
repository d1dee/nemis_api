/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Document, InferSchemaType } from "mongoose";
import { learnerSchema } from "@database/learner";
import ApiHandler from "@libs/nemis/api_handler";
import LearnerHandler from "@libs/nemis/learner_handler";

// Learner as returned by the database.
export type Learner = InferSchemaType<typeof learnerSchema>;
export type LearnerDocument = Learner & Document;

export type Results = Awaited<ReturnType<ApiHandler['results']>>;
export type Admission = Awaited<ReturnType<ApiHandler['admission']>>;
export type ReportedCaptured = Awaited<ReturnType<ApiHandler['reportedCaptured']>>;
export type SearchLearner = Awaited<ReturnType<ApiHandler['searchLearner']>>;

/**
 * Learner returned by http://nemis.education.go.ke/Learner/Listlearners.aspx on the NEMIS website
 */
export type ListLearners = Exclude<Awaited<ReturnType<LearnerHandler['listLearners']>>, null>;
export type ListAdmittedLearners = Exclude<
    Awaited<ReturnType<LearnerHandler['listAdmittedJoiningLearners']>>,
    null
>;
export type RequestedJoiningLearner = Awaited<ReturnType<LearnerHandler['getApprovedJoiningLearners']>>;
export type AdmittedLearners = Awaited<ReturnType<LearnerHandler['listAdmittedJoiningLearners']>>;
export type SelectedLearner = Awaited<ReturnType<LearnerHandler['getSelectedLearners']>>;
