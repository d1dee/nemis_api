/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Router } from "express";
import authRouter from "./auth";
import institutionRouter from "./institution";
import learner_router from "./learner";
import { nemisRoute } from "@routes/nemis";

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/nemis', nemisRoute);
apiRouter.use('/learner', learner_router);

apiRouter.use('/institution', institutionRouter);

export default apiRouter;

/**
 * localhost:3000/
 *
 * /api/auth✅
 *          /register✅
 *              [POST] => register an institution✅
 *          /refresh✅
 *              [GET] => refresh jwt token✅
 *
 *     /institution✅
 *          [GET] => get institution details✅
 *          [PATCH] => update institution✅
 *          [DELETE] => delete an institution✅
 *
 *     /learner_router
 *          [GET] => get all learners from APIs database
 *          [PATCH] => update multiple learners using json in APIs database
 *
 *          /add
 *               [POST] => add multiple learners using json to APIs database
 *               [PUT] => add multiple learner_router using Excel file ✅
 *          /admit
 *              /new
 *                  [POST] {adm if in db || a complete learner_router object || none to admit all form ones}
 *                      => add a new learner_router to nemis while also syncing APIs database with that of nemis if
 *                          no learner_router is submitted
 *                  /{adm}
 *                      [POST] {a complete learner_router object} => admit that specific learner_router
 *              /continuing
 *                  [POST] {adm if in db  || a complete learner_router object}
 *                      => add a continuing learner_router to nemis. if a learner_router object is submitted, they're
 *                          automatically added to APIs database
 *                   /{adm}
 *                      [POST] {a complete learner_router object} => admit that specific learner_router
 *
 *          /search?{birthCertificateNo||upi} => search learner_router information from nemis api
 *              (http://nemis.education.go.ke/generic/api/Learner/StudUpi/{upi/birthCertificateNo}) ✅
 *
 *         /transfer
 *              [GET] => get all transfers
 *              /in
 *                  [GET] => get all transfer in requests
 *                  [POST] {adm || upi || birthCertificateNo, reason,remarks} => transfer out specified learner_router
 *              /out
 *                  [GET] => get all transfer out requests
 *                  [POST]?{upi} => transfer out a requested learner_router
 *
 *        /selected
 *              [GET] => get all selected learners✅
 *
 *       /admit
 *              [GET] => get already admitted learners
 *              [POST]?{array<adm> || adm} => admit learner_router if adm is specified or all forms one learner_router
 *                  who isn't already admitted. this end point also requests learners if they weren't selected
 *
 *      /sync
 *          [Get] => trigger database sync to import all learners from nemis and match them to adm number
 *              in APIs database
 *
 *      /report?{admitted,captured, nhif,birthCertificate,index}
 *          [GET] => get a report of all learners with issues
 */
