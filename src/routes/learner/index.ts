/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Router } from "express";
import addLearnerRoute from "./add_learner";
import { searchLearner } from "@middleware/learner/search_learner";
import { syncLearnerDatabase } from "@middleware/learner/sync_learner";
import { deleteSingleLearner } from "@middleware/learner/delete_learner";
import listLearners from "@middleware/learner/list_learners";

const learnerRoute = Router();

learnerRoute.use('/add', addLearnerRoute);
learnerRoute.get('/list', listLearners);
learnerRoute.use('/sync', syncLearnerDatabase);

learnerRoute.get('/search/:uniqueIdentifier', searchLearner);

learnerRoute.delete('/delete/:uniqueIdentifier', deleteSingleLearner);

export default learnerRoute;
