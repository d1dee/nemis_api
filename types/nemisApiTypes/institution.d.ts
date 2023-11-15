/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { institutionSchema, nemisInstitutionDataSchema } from "@database/institution";
import { Document, InferSchemaType } from "mongoose";
import { Z_GRADE } from "@libs/constants";
import { z } from "zod";

export type NemisInstitutionData = InferSchemaType<typeof nemisInstitutionDataSchema>;
export type Institution = InferSchemaType<typeof institutionSchema>;

export interface InstitutionDocument extends InferSchemaType<typeof institutionSchema>, Document {}

export type Grade = z.infer<typeof Z_GRADE>;
