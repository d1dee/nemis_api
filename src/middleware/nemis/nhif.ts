/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from "express";

const submitNhif = async (req: Request) => {
    try {
        const queryParams = req.queryParams;
        if (!queryParams?.grade)
            throw {
                code: 400,
                message: "Please specify grade/ form of the learners you wish to submit to nhif",
                cause: "You did not specify the grade or form you wish to submit."
            };
        const nemis = req.nemis;
        let learnerWithoutNhif = (await nemis.listLearners(queryParams.grade))?.filter(
            x => !x.nhifNo
        );
        if (!learnerWithoutNhif) {
            return req.sendResponse.respond({}, "Couldn't find any learner_router to submit to NHIF");
        }
        if (req.queryParams?.await) {
            let res = await nemis.submitToNhif(queryParams.grade, learnerWithoutNhif);
            return req.sendResponse.respond(
                res,
                "Below learners have been successfully submitted to NHIF"
            );
        }
        req.sendResponse.respond(
            learnerWithoutNhif,
            "Below learners will be submitted to NHIF in the background."
        );
        await nemis.submitToNhif(queryParams.grade, learnerWithoutNhif);
        //console.log(k);
    } catch (err: any) {
        req.sendResponse.error(
            err.code || 500,
            err.message || "Internal server error",
            err.cause || ""
        );
    }
};
const getNhif = async (req: Request) => {
    try {
        const queryParams = req.queryParams;
        if (!queryParams.grade)
            throw {
                code: 400,
                message: "Please specify grade/ form of the learners you wish to submit to nhif",
                cause: "You did not specify the grade or form you wish to submit."
            };

        const nemis = req.nemis;
        let results = await nemis.listLearners(queryParams.grade);
        if (!results) {
            throw {
                code: 500,
                message: "List learners is undefined.",
                cause: "List learner_router method didn't return any learner_router. Maybe NEMIS is down?"
            };
        }
        let returnResults;
        Object.keys(queryParams).forEach(x => {
            switch (x) {
                case "nhif":
                    returnResults = results?.filter(x => {
                        if (queryParams.nhif) return x.nhifNo;
                        return !x.nhifNo;
                    });
                    break;
                case "upi":
                case "birthCertificateNo":
                    returnResults = results?.filter(
                        x =>
                            queryParams.birthCertOrUpi?.filter(
                                j => j?.toLowerCase() == x.upi?.toLowerCase()
                            ).length === 1
                    );
            }
        });
        req.sendResponse.respond(returnResults);
    } catch (err: any) {
        req.sendResponse.error(
            err.code || 500,
            err.message || "Internal server error",
            err.cause || ""
        );
    }
};
export { submitNhif, getNhif };
