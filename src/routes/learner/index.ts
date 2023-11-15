/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request, Router } from "express";
import fileUpload from "express-fileupload";
import verify_excel_upload from "@middleware/utils/verify_excel_upload";
import Learner from "@middleware/learner";

const learnerRoute = Router();

// Add continuing and joining learners
learnerRoute.post(['/add/joining/json', '/add/continuing/json'], (req: Request) =>
    new Learner(req).addLearnerByJson()
);
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
    async (req: Request) => await new Learner(req).addLearnerByFile()
);

learnerRoute.get('/list', (req: Request) => new Learner(req).listLearner());

learnerRoute.get('/sync', (req: Request) => new Learner(req).syncLearnerDatabase());

learnerRoute.get('/search/:id', (req: Request) => new Learner(req).searchLearner());

learnerRoute.delete('/delete', (req: Request) => new Learner(req).deleteLearner());

export default learnerRoute;
