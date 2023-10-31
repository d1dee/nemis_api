/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { institutionSchema, nemisInstitutionDataSchema } from "@database/institution";
import { InferSchemaType } from "mongoose";

export type NemisInstitutionData = InferSchemaType<typeof nemisInstitutionDataSchema>;
export type Institution = InferSchemaType<typeof institutionSchema>;
