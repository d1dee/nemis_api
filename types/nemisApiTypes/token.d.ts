/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import mongoose, { InferSchemaType } from "mongoose";
import { tokenSchema } from "@database/token";

export type Token = InferSchemaType<typeof tokenSchema>;
export type TokenDocument = Token & mongoose.Document;
