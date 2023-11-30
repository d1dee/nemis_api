/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request, Router } from "express";
import Nemis from "@middleware/nemis";

const nemisRoute = Router();

nemisRoute.get('/search', (req: Request) => new Nemis(req).searchLearner());

nemisRoute.post('/admit/joining', (req: Request) => new Nemis(req).admitJoiningLearner);
nemisRoute.post('/admit/joining/:id', (req: Request) => new Nemis(req).admitSingleJoiningLearner);
nemisRoute.post('/capture/joining', (req: Request) => new Nemis(req).captureJoiningLearner);
nemisRoute.post('/capture/joining/:id', (req: Request) => new Nemis(req).captureSingleJoiningLearner);

nemisRoute.post('/capture/continuing', (req: Request) => new Nemis(req).captureContinuingLearner);
nemisRoute.post('/capture/continuing/:id', (req: Request) => new Nemis(req).captureSingleContinuingLearner);

export { nemisRoute };
