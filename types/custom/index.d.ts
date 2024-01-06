/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import Respond from "../../src/controller/utils/send_response";
import { TokenDocument } from "../nemisApiTypes/token";
import { InstitutionDocument } from "../nemisApiTypes/institution";
import { utils } from "xlsx";


declare module 'express-serve-static-core' {
    export interface Request {
        // The current institution associated with the bearer token in req.Authorization
        institution: InstitutionDocument;
        // Bearer authorization token
        token: TokenDocument;
        // A custom class used to format  error messages and responses before sending them to the client
        respond: Respond;
        parsedExcel: any[]
    }
}
