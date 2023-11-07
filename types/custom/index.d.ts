/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import Respond from "@middleware/utils/send_response";
import { Institution } from "../nemisApiTypes/institution";
import { Token } from "../nemisApiTypes/token";

declare module 'express-serve-static-core' {
    export interface Request {
        // The current institution associated with the bearer token in req.Authorization
        institution: Institution;
        // Bearer authorization token
        token: Token;
        // A custom class used to format  error messages and responses before sending them to the client
        respond: Respond;
    }
}
