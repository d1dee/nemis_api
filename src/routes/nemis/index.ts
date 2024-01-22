/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { Request, Router } from 'express';
import fileUpload from 'express-fileupload';
import Nemis from '@controller/nemis';
import excelParserMiddleware from '@middleware/excel_parser';
import verifyExcelUploadsMiddleware from '@middleware/verify_excel_upload';

const nemisRoute = Router();
nemisRoute.post('/joining/request', (req: Request) => new Nemis(req).requestJoiningLearner());
nemisRoute.post('/joining/request/json', (req: Request) => new Nemis(req).requestJoiningLearner());
nemisRoute.post(
    '/joining/request/excel',
    fileUpload({
        useTempFiles: true,
        tempFileDir: `${process.cwd()}/uploads/temp/request_joining`,
        preserveExtension: true,
        debug: true,
        parseNested: true,
        createParentPath: true
    }),
    verifyExcelUploadsMiddleware,
    excelParserMiddleware,
    (req: Request) => new Nemis(req).requestJoiningLearner()
);

nemisRoute.get('/search', (req: Request) => new Nemis(req).searchLearner());
nemisRoute.get('/list', (req: Request) => new Nemis(req).listLearners());
nemisRoute.post('/joining/admit', (req: Request) => new Nemis(req).admitJoiningLearner());
nemisRoute.post('/joining/admit/:id', (req: Request) => new Nemis(req).admitJoiningLearner());

nemisRoute.post('/joining/capture', (req: Request) => new Nemis(req).captureJoiningLearner());
nemisRoute.post('/joining/capture/:id', (req: Request) => new Nemis(req).captureJoiningLearner());

nemisRoute.post('/continuing/capture', (req: Request) => new Nemis(req).captureContinuingLearner());
nemisRoute.post('/continuing/capture/:id', (req: Request) => new Nemis(req).captureContinuingLearner());

export { nemisRoute };
