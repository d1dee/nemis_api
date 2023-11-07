/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import Respond from "@middleware/utils/send_response";
import { Institution } from "../nemisApiTypes/institution";
import { Token } from "../nemisApiTypes/token";
import { Document } from "mongoose";

declare module 'express-serve-static-core' {
    export interface Request {
        // The current institution associated with the bearer token in req.Authorization
        institution: Institution & Document;
        // Bearer authorization token
        token: Token & Document;
        // A custom class used to format  error messages and responses before sending them to the client
        respond: Respond;
    }
}
