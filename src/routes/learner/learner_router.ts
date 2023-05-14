/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Router } from 'express';
import addLearnerRoute from './add_learner';
import deleteLearnerRoute from './delete_learner';
import { searchLearner } from '../../middleware/learner/search_learner';
import { syncLearnerDatabase } from '../../middleware/learner/sync_learner';

const learner_router = Router();

learner_router.use('/add', addLearnerRoute);
learner_router.use('/delete', deleteLearnerRoute);
learner_router.get('/search/:uniqueIdentifier', searchLearner);
learner_router.use('/sync', syncLearnerDatabase);

export default learner_router;
