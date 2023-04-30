import { Router } from "express";
import syncLearner from "../../middleware/learner/sync_learner";

const syncLearnersRoute = Router();

syncLearnersRoute.post("/", syncLearner);
export default syncLearnersRoute;