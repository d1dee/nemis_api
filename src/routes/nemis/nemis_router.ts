import { Router } from 'express';
import { admitRoute } from './admit_router';
import search from '@middleware/nemis/search';
import { captureRoute } from './capture_router';

const nemisRoute = Router();

nemisRoute.use('/capture', captureRoute);
nemisRoute.use('/admit', admitRoute);

//nemisRoute.get('/list/learners');
nemisRoute.get('/search/:uniqueIdentifier', search);

export { nemisRoute };
