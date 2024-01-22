/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { institutionSchema, nemisInstitutionDataSchema } from '@database/institution';
import { Document, InferSchemaType } from 'mongoose';
import {
    Z_GRADE,
    Z_ID,
    Z_INDEX_NUMBER,
    Z_NAMES,
    Z_NUMBER_STRING,
    Z_PHONE_NUMBER,
    Z_STRING
} from '@libs/constants';
import { z } from 'zod';

export type NemisInstitutionData = InferSchemaType<typeof nemisInstitutionDataSchema>;
export type Institution = InferSchemaType<typeof institutionSchema>;

export interface InstitutionDocument extends InferSchemaType<typeof institutionSchema>, Document {}

export type Grade = z.infer<typeof Z_GRADE>;

export type RecordsPerPage =
    | '10'
    | '20'
    | '50'
    | '100'
    | '200'
    | '500'
    | '1000'
    | '5000'
    | '10000'
    | '25000'
    | '50000'
    | '100000';
