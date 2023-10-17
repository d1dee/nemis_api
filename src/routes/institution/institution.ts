/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { json, Router } from 'express';
import { deleteInstitution, getInstitution, updateInstitution } from '../../middleware/institution/institution';

const institution = Router().use(json());

institution.get('/', getInstitution);
institution.post('/update', updateInstitution);
institution.delete('/delete', deleteInstitution);

export default institution;
