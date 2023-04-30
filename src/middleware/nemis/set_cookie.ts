/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { NextFunction, Request, Response } from "express";
import institution_schema from "../../database/institution";
import logger from "../../libs/logger";
import { Nemis } from "../../libs/nemis";

export default async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.nemis) return next();
        if (!req.institution) return next();
        const nemis = new Nemis();
        const { username, password, cookie, _id } = req.institution;
        if (cookie?.value && !(await nemis.setCookie(cookie?.value))) {
            // set cookie and check if valid at the same time
            let cookie = await nemis.login(username, password);
            await institution_schema.findByIdAndUpdate(_id, {
                $set: {
                    cookie: {
                        value: cookie,
                        expires: Date.now() + 1000 * 60 * 60
                    }
                }
            });
            logger.info("Cookie refreshed");
        }
        req.nemis = nemis;
        logger.info("Nemis set, calling next()");
        return next();
    } catch (err: any) {
        req?.sendResponse?.error(err.code || 500, "Internal server error", err.message || "");
    }
};
