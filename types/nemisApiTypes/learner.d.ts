/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { InferSchemaType } from "mongoose";
import { learnerSchema } from "@database/learner";

export type Learner = InferSchemaType<typeof learnerSchema>