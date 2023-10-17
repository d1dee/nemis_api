import { Router } from "express";
import { deleteBulkLearner, deleteSingleLearner } from "@middleware/learner/delete_learner";

const deleteLearnerRoute = Router();

deleteLearnerRoute.delete("/bulk/:grade", deleteBulkLearner);

deleteLearnerRoute.delete("/:uniqueIdentifier", deleteSingleLearner);
export default deleteLearnerRoute;