/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { json, NextFunction, Request, Response, Router } from "express";
import { deleteInstitution, getInstitution, updateInstitution } from "../../middleware/institution/institution";

const institution = Router().use(json());

institution.get('/', getInstitution);
institution.patch('/update', updateInstitution);
institution.delete('/delete', deleteInstitution);

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
