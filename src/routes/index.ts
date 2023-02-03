/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import set_cookie from '../middleware/set_cookie';
import authRouter from './auth';
import institution from './institution';
import learner from './learner';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
//apiRouter.use('/nemis', nemis_router);
apiRouter.use('/learner', set_cookie, learner);

apiRouter.use('/institution', institution);

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
 *     /learner
 *          [GET] => get all learners from api's database
 *          [PATCH] => update multiple learners using json in api's database
 *
 *          /add
 *               [POST] => add multiple learners using json to api's database
 *               [PUT] => add multiple learner using Excel file ✅
 *          /admit
 *              /new
 *                  [POST] {adm if in db || a complete learner object || none to admit all form ones}
 *                      => add a new learner to nemis while also syncing api's database with that of nemis if
 *                          no learner is submitted
 *                  /{adm}
 *                      [POST] {a complete learner object} => admit that specific learner
 *              /continuing
 *                  [POST] {adm if in db  || a complete learner object}
 *                      => add a continuing learner to nemis. if a learner object is submitted they are
 *                          automatically added to api's database
 *                   /{adm}
 *                      [POST] {a complete learner object} => admit that specific learner
 *
 *          /search?{birthCertificateNo||upi} => search learner information from nemis api
 *              (http://nemis.education.go.ke/generic/api/Learner/StudUpi/{upi/birthCertificateNo}) ✅
 *
 *         /transfer
 *              [GET] => get all transfers
 *              /in
 *                  [GET] => get all transfer in requests
 *                  [POST] {adm || upi || birthCertificateNo, reason,remarks} => transfer out specified learner
 *              /out
 *                  [GET] => get all transfer out requests
 *                  [POST]?{upi} => transfer out a requested learner
 *
 *        /selected
 *              [GET] => get all selected learners✅
 *
 *       /admit
 *              [GET] => get already admitted learners
 *              [POST]?{array<adm> || adm} => admit learner if adm is specified or all form one learner
 *                  who aren't already admitted. this end point also requests learner if they weren't selected
 *
 *      /sync
 *          [Get] => trigger database sync to import all learners from nemis and match them to adm number
 *              in api's database
 *
 *      /report?{admitted,captured, nhif,birthCertificate,index}
 *          [GET] => get a report of all leaner with issues
 */
