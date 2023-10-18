/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Router } from 'express';
import { admitJoiningLearner, admitSingleJoiningLearner } from '@middleware/nemis/admit';
//import { admitContinuingLearner } from "../../middleware/nemis/continuing";

const admitRoute = Router();

admitRoute.post('/joining', admitJoiningLearner);
admitRoute.post('/joining/:uniqueIdentifier', admitSingleJoiningLearner);

export { admitRoute };
