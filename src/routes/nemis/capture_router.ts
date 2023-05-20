import { Router } from 'express';
import { captureContinuingLearner } from '../../middleware/nemis/continuing';
import { captureJoiningLearner, captureSingleJoiningLearner } from '../../middleware/nemis/joining';

const captureRoute = Router();
/**
 * First add learner to database then call capture
 */

captureRoute.post('/joining', captureJoiningLearner);
captureRoute.post('/joining/:uniqueIdentifier', captureSingleJoiningLearner);

captureRoute.post('/continuing', captureContinuingLearner);

export { captureRoute };
