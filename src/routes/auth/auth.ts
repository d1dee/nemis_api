/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { json } from "body-parser";
import { Request, Router } from "express";
import refreshToken from "../../middleware/auth/refresh_token";
import registerToken from "../../middleware/auth/register_token";

const authRoute = Router();

authRoute.use((req: Request, _, next) => {
    if (req.path === "/refresh" && req.method !== "GET") {
        return req.sendResponse.error(405, "Method not allowed", [
            "Only GET requests are allowed on this route"
        ]);
    }
    if (req.path === "/register" && req.method !== "POST") {
        return req.sendResponse.error(405, "Method not allowed", [
            "Only POST requests are allowed on this route"
        ]);
    }
    next();
});

authRoute.get("/refresh", refreshToken);

authRoute.post("/register", json(), registerToken);

export default authRoute;
