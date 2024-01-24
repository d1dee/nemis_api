/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { Document, InferSchemaType } from 'mongoose';
import { learnerSchema } from '@database/learner';
import ApiHandler from '@libs/nemis/api_handler';
import LearnerHandler from '@libs/nemis/learner_handler';
import { z } from 'zod';
import MiddlewareLearner from '../../src/controller/learner';
import { LEARNER_FIELDS } from '@libs/constants';
import { Z_REQUEST_JOINING_lEARNERS } from '@controller/constants'; // Learner as returned by the database.

// Learner as returned by the database.
export type Learner = InferSchemaType<typeof learnerSchema>;

export interface LearnerDocument extends Learner, Document {}

export type Results = Awaited<ReturnType<ApiHandler['results']>>;
export type ReportedCaptured = Awaited<ReturnType<ApiHandler['reportedCaptured']>>;
export type Reported = Awaited<ReturnType<ApiHandler['reported']>>;
export type SearchLearner = Awaited<ReturnType<ApiHandler['searchLearner']>>;
//export type CaptureBiodata = Awaited<ReturnType<LearnerHandler['captureBioData']>>;

export type ListLearners = Exclude<Awaited<ReturnType<LearnerHandler['listLearners']>>, null>;
export type ListAdmittedLearners = Exclude<
    Awaited<ReturnType<LearnerHandler['listAdmittedJoiningLearners']>>,
    null
>;
export type RequestJoiningLearnerDetails = z.infer<typeof Z_REQUEST_JOINING_lEARNERS>;
// getRequestedJoiningLearners && getApprovedRequestedJoiningLearners return the same type
export type RequestedAndApprovedLearners = Awaited<ReturnType<LearnerHandler['getRequestedJoiningLearners']>>;

export type AdmittedLearners = Awaited<ReturnType<LearnerHandler['listAdmittedJoiningLearners']>>;
export type RequestJoiningLearner = Awaited<ReturnType<LearnerHandler['requestJoiningLearner']>>;
export type SelectedLearner = Awaited<ReturnType<LearnerHandler['getSelectedLearners']>>;

type ValidLearner = z.infer<typeof MiddlewareLearner.prototype.validations.learner>;
type ExtraValidationFields = 'county' | 'contacts' | 'transfer';
type DefaultLearnerValidationFields = (typeof LEARNER_FIELDS)[number];

export type LearnerValidationFields = { [k in DefaultLearnerValidationFields]?: true };
