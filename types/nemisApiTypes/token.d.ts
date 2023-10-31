/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { InferSchemaType } from "mongoose";
import { tokenSchema } from "@database/token";

export type Token = InferSchemaType<typeof tokenSchema>