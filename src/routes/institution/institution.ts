/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { json, NextFunction, Request, Response, Router } from "express";
import { deleteInstitution, getInstitution, updateInstitution } from "../../middleware/institution/institution";

const institution = Router().use(json());

institution.get("/", getInstitution);
institution.patch("/update", updateInstitution);
institution.delete("/delete", deleteInstitution);
institution.use("/", (req: Request, res: Response, next: NextFunction) => {
    let response = req.sendResponse;
    if (!["GET", "PATCH", "DELETE"].includes(req.method)) {
        return response.error(405, "Method not allowed", [
            "Only GET,PATCH,DELETE requests are allowed on this route"
        ]);
    }
    next();
});

export default institution;
/**
 /institution (get for info, post for create, put for update, delete for delete)✅
 /list
 /admitted
 /transfer_out
 /transfer_in
 /issues (with specific filters)
 /search
 **/
