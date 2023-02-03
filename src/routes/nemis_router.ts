/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {Router} from 'express';
import {getNhif} from '../middleware/learner/nhif';

const nemisRouter = Router();

nemisRouter.get('/', (req, res) => {
	res.send('Nemis API');
});
//report on learners per form, non teaching and teaching staffs dates (direct copy of nemis api on homepage)
/**
 * /nhif
 * /learner
        /transfer
        /release
        /search
        /admit
            /continuing (bulk if more than one learner)
            /form1 (bulk if more than one learner)
        /request(admit/capture requests)
        /selected (view selected form1 list)
        /capture
            /continuing (wait for approval from nemis) (bulk if more than one learner )
            /form1
**/
nemisRouter.get('/nhif', getNhif);
export default nemisRouter;