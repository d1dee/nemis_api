/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Document, InferSchemaType } from 'mongoose';
import { learnerSchema } from '@database/learner';
import ApiHandler from '@libs/nemis/api_handler';
import LearnerHandler from '@libs/nemis/learner_handler';
import { z } from 'zod';
import MiddlewareLearner from '@middleware/learner';
import { LEARNER_FIELDS } from '@libs/constants';

// Learner as returned by the database.
export type Learner = InferSchemaType<typeof learnerSchema>;

export interface LearnerDocument extends Learner, Document {}

export type Results = Awaited<ReturnType<ApiHandler['results']>>;
export type Admission = Awaited<ReturnType<ApiHandler['admission']>>;
export type ReportedCaptured = Awaited<ReturnType<ApiHandler['reportedCaptured']>>;
export type SearchLearner = Awaited<ReturnType<ApiHandler['searchLearner']>>;
export type CaptureBiodata = Awaited<ReturnType<LearnerHandler['captureBioData']>>;

export type ListLearners = Exclude<Awaited<ReturnType<LearnerHandler['listLearners']>>, null>;
export type ListAdmittedLearners = Exclude<
    Awaited<ReturnType<LearnerHandler['listAdmittedJoiningLearners']>>,
    null
>;
export type RequestedJoiningLearner = Awaited<ReturnType<LearnerHandler['getApprovedJoiningLearners']>>;
export type AdmittedLearners = Awaited<ReturnType<LearnerHandler['listAdmittedJoiningLearners']>>;
export type SelectedLearner = Awaited<ReturnType<LearnerHandler['getSelectedLearners']>>;

type ValidLearner = z.infer<typeof MiddlewareLearner.prototype.validations.learner>;
type ExtraValidationFields = 'county' | 'contacts' | 'transfer';
type DefaultLearnerValidationFields = (typeof LEARNER_FIELDS)[number];

export type LearnerValidationFields = { [k in DefaultLearnerValidationFields]?: true };
