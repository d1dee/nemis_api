/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Router } from "express";
import { searchLearner } from "@middleware/learner/search_learner";
import { syncLearnerDatabase } from "@middleware/learner/sync_learner";
import { deleteSingleLearner } from "@middleware/learner/delete_learner";
import listLearners from "@middleware/learner/list_learners";
import fileUpload from "express-fileupload";
import { addLearnerByFile, addLearnerByJson } from "@middleware/learner/add_learner";
import verify_excel_upload from "@middleware/utils/verify_excel_upload";

const learnerRoute = Router();

// Add continuing and joining learners
learnerRoute.post(['/add/joining/json', '/add/continuing/json'], addLearnerByJson);
learnerRoute.post(
    ['/add/joining/excel', '/add/continuing/excel'],
    fileUpload({
        useTempFiles: true,
        tempFileDir: `${process.cwd()}/uploads/temp/`,
        preserveExtension: true,
        debug: true,
        parseNested: true,
        createParentPath: true
    }),
    verify_excel_upload,
    addLearnerByFile
);

learnerRoute.get('/list', listLearners);

learnerRoute.get('/sync', syncLearnerDatabase);

learnerRoute.get('/search/:id', searchLearner);

learnerRoute.delete('/delete', deleteSingleLearner);

export default learnerRoute;
