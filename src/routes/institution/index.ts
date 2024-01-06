/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { json, Router } from "express";
import { deleteInstitution, getInstitution, updateInstitution } from "../../controller/institution/";

const index = Router().use(json());

index.get('/', getInstitution);
index.post('/update', updateInstitution);
index.delete('/delete', deleteInstitution);

export default index;
