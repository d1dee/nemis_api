import { Router } from "express";
import { addLearnerByFile, addLearnerByJson } from "@middleware/learner/add_learner";
import fileUpload from "express-fileupload";
import verify_excel_upload from "@middleware/utils/verify_excel_upload";


const addLearnerRoute = Router();

addLearnerRoute.post(["/joining/excel", "/continuing/excel"], fileUpload({
        useTempFiles: true,
        tempFileDir: `${process.cwd()}/uploads/temp/`,
        preserveExtension: true,
        debug: true,
        parseNested: true,
        createParentPath: true
    }),
    verify_excel_upload,
    addLearnerByFile);

addLearnerRoute.post(["/joining/json", "/continuing/json"], addLearnerByJson);

export default addLearnerRoute;