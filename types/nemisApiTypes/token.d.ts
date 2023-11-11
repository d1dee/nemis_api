/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Document, InferSchemaType } from "mongoose";
import { tokenSchema } from "@database/token";

export type Token = InferSchemaType<typeof tokenSchema>;

export interface TokenDocument extends Token, Document {}
