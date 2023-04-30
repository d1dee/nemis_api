import { Router } from "express";
import { captureContinuingLearner } from "../../middleware/nemis/continuing";
import { captureJoiningLearner } from "../../middleware/nemis/joining";

const captureRoute = Router();
/**
 * First add learner to database then call capture
 */

captureRoute.post("/continuing", captureContinuingLearner);
captureRoute.post("/joining", captureJoiningLearner);
export {
    captureRoute
};