/*
/!*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 *!/

import { NextFunction, Request, Response } from "express";
import moment from "moment/moment";
import { Grades } from "../../../types/nemisApiTypes";
import logger from "../../libs/logger";
import { QueryParams } from "../interfaces";
import { sendErrorMessage } from './middlewareErrorHandler';
import { zod } from '../../libs/zod_validation';

const allowedParameters = (req:Request,res:Response,next:NextFunction)=>{
    try {
        switch(true){
            case
        }

    } catch (err) {
        sendErrorMessage(req,err)
    }
}

let uniqueIdentifierSchema = zod.string({
    required_error: 'Unique identifier is not specified. It might be UPI number, birth certificate number or learner\' adm number',
    invalid_type_error:'Invalid type error. unique identifiers can only be of type string.'
})


/!*(req: Request, res: Response, next: NextFunction) => {
    try {
        if (Object.entries(req.query).length === 0) {
            logger.debug("No query params supplied");
            return next();
        }
        // List of allowed queryParams
        const allowedParams = [
            "adm",
            "admitted",
            "birthCertificateNo",
            "dob",
            "fields",
            "grade",
            "form",
            "limit",
            "sort",
            "stream",
            "upi",
            "nhif",
            "index",
            "await",
            "approved",
            "ignoreNonEssentialBlanks"
        ];
        const queryKeys = Object.keys(req.query);
        const invalidParams = queryKeys.filter(param => !allowedParams.includes(param));
        // Return error if we have an invalid key
        if (invalidParams.length > 0) {
            throw {
                code: 400,
                message: `Invalid Query Parameter${
                    invalidParams.length > 1 ? "s were" : " was"
                } supplied`,
                cause: invalidParams
            };
        }
        // validate return fields
        let query: QueryParams = {};
        for (const key in queryKeys) {
            switch (queryKeys[key]) {
                case "fields":
                    if (!req.query["fields"]) break;
                    let fields = req.query["fields"]
                        .toString()
                        .split(",")
                        .map(x => x.trim());
                    const allowedLearnerFields = [
                        "dob",
                        "nhif",
                        "father",
                        "mother",
                        "guardian",
                        "contacts",
                        "isSpecial",
                        "marks",
                        "gender",
                        "stream",
                        "grade",
                        "admitted",
                        "status"
                    ];
                    let invalidFields = fields.filter(
                        field => !allowedLearnerFields.includes(field)
                    );
                    let validFields = fields.filter(field => allowedLearnerFields.includes(field));
                    // If path is institution check if any of the invalidFields is a valid institution field
                    if (req.path === "/api/v1/institution") {
                        /!**note
                         *  location includes:
                         *     constituency
                         *     zone
                         *     ward
                         *     plusCode*!/
                        const allowedInstitutionFields = [
                            "knecCode",
                            "type",
                            "code",
                            "registrationNumber",
                            "cluster",
                            "accommodation",
                            "location",
                            "kraPin",
                            "createdAt",
                            "lastLogin",
                            "learners",
                            "teachers",
                            "nonTeaching",
                            "cookie",
                            "location",
                            "lastToken"
                        ];

                        validFields.push(
                            ...invalidFields.filter(field =>
                                allowedInstitutionFields.includes(field.trim())
                            )
                        );
                        invalidFields.push(
                            ...invalidFields.filter(
                                field => !allowedInstitutionFields.includes(field.trim())
                            )
                        );
                    }
                    // If we have any invalid field, return error
                    if (invalidFields.length > 0) {
                        throw {
                            code: 400,
                            message: `Invalid Field${
                                invalidFields.length > 1 ? "s were" : " was"
                            } supplied`,
                            cause: "The following fields were invalid",
                            invalidFields
                        };
                    }
                    if (validFields.length > 0)
                        logger.debug("Setting query fields to " + validFields.join(", "));
                    query.fields = validFields;
                    break;
                //check if other parameters are valid
                case "adm":
                    // Might be one or many admission numbers seperated by commas
                    let admQuery = String(req.query.adm);
                    // adm is a string since some schools have string characters
                    if (!admQuery) {
                        throw {
                            code: 400,
                            message: "Invalid Admission Number/string",
                            cause: `${req.query.adm} is not a valid admission number`
                        };
                    }
                    query.adm = admQuery
                        .split(",")
                        .map(adm => adm.trim())
                        .filter(adm => !!adm);
                    logger.debug("Setting adm to " + query.adm);
                    break;
                case "admitted":
                case "nhif":
                case "await":
                case "approved":
                case "ignoreNonEssentialBlanks":
                    let keyValue = req.query[queryKeys[key]];
                    if (keyValue === undefined) {
                        break;
                    }
                    keyValue = String(keyValue)?.toLowerCase();
                    if (keyValue !== "true" && keyValue !== "false")
                        throw {
                            code: 400,
                            message: `${queryKeys[key]} should be a boolean`,
                            cause: `${queryKeys[key]} is not a valid boolean, ${keyValue} is not a boolean`
                        };
                    logger.debug("Setting " + queryKeys[key] + " to " + keyValue);

                    query[
                        <"admitted" | "nhif" | "await" | "approved" | "ignoreNonEssentialBlanks">(
                            queryKeys[key]
                        )
                        ] = keyValue === "true";
                    break;
                case "dob":
                    let dobQuery = req.query?.dob;
                    if (!dobQuery) break;
                    dobQuery = String(dobQuery);
                    let momentDob = moment(dobQuery, "DD-MM-YYYY");
                    if (!momentDob.isValid())
                        throw {
                            code: 400,
                            message: "Invalid Date.",
                            cause: `${req.query?.dob} is not a valid date`
                        };
                    if (moment(momentDob).isValid())
                        throw {
                            code: 400,
                            message: "Invalid Date Format",
                            cause: "Date should be in DD-MM-YYYY format"
                        };
                    logger.debug("Setting date to " + dobQuery);
                    query.dob = momentDob.toDate();
                    break;
                /!*case 'sort':
                let sort = req.query.sort.toString().split(',');
                // note: When sorting using grade stream sort is done automatically
                // only one sort field is allowed to avoid complex sorting
                if (sort.length > 1)
                    throw {code:400,message: 'Invalid Sort', [
                        'Received more than one sort field whilst only one sort field is allowed'
                    ]);
                const validSortArray = ['name', 'dob', 'upi', 'adm', 'nhifNo', 'isSpecial', 'grade'];
                let validSort: string[] = [];
                let invalidSort = sort.filter(field => {
                    let splitFields = field.split('-');
                    return splitFields.length === 2
                        ? splitFields[0] === 'asc' || splitFields[0] === 'desc'
                            ? validSortArray.includes(splitFields[1])
                                ? !validSort.push(field)
                                : true
                            : true
                        : true;
                });
                /!*let validSort = sort.filter(field => {
                    let splitFields = field.split('-');
                    return splitFields.length === 2
                        ? splitFields[0] === 'asc' || splitFields[0] === 'desc'
                            ? validSortArray.includes(splitFields[1])
                            : false
                        : false;
                });*!/
                if (invalidSort.length > 0) {
                    return response.error
                        400,
                        `Invalid Sort field${invalidSort.length > 1 ? 's were' : ' was'} supplied`,
                        [
                            {
                                invalid: invalidSort,
                                valid: validSort
                            }
                        ]
                    );
                }
                if (validSort.length === 1) {
                    logger.debug('Sorting by ' + validSort[0]);
                    query.sort = validSort.toString();
                }
                break;*!/
                /!*case 'upi':
                    let upiQuery = req.query.upi;
                    if (!upiQuery) break;
                    upiQuery = String(upiQuery).trim();
                    if (upiQuery.length! > 3)
                        throw {code:400,message: 'Invalid UPI', [
                            `${req.query.upi} is not a valid UPI`
                        ]);
                    logger.debug('Setting upi to ' + upiQuery);
                    query.upi = upiQuery;
                    break;*!/
                case "limit":
                    let limitQuery = Number(req.query.limit);
                    if (isNaN(limitQuery)) {
                        throw {
                            code: 400,
                            message: "Invalid Limit",
                            cause: `${req.query.limit} is not a valid limit`
                        };
                    }
                    //limit should be divisible by 10
                    if (limitQuery % 10 !== 0)
                        throw {
                            code: 400,
                            message: "Invalid Limit",
                            cause: `Limit should be in steps of 10`
                        };
                    logger.debug("Setting limit to " + limitQuery);
                    query.limit = limitQuery;
                    break;
                //note: Grades limit will change once the new cbc is implemented. for now is 1 - 4
                case "grade":
                case "form":
                    if (!req.query.grade || !req.query.form) break;
                    let queryGrade = String(req.query.grade || req.query.form)
                        .trim()
                        .toLowerCase();
                    // Should start with grade followed by at most two numbers or form followed by one
                    // number
                    if (!/(^grade.\d{1,2}$|(?:^form|^pp).\d$)/.test(queryGrade))
                        throw {
                            code: 400,
                            message: "Invalid Grade",
                            cause: `${
                                req.query.grade || req.query.form
                            } is not a valid grade. example form pp 1, grade 1, form 1`
                        };
                    let gradeNo = queryGrade.match(/\d+/)?.shift() || undefined;
                    if (!gradeNo) {
                        throw {
                            code: 400,
                            message: "Invalid Grade",
                            cause: `${
                                req.query.grade || req.query.form
                            } is not a valid grade. example form pp 1, grade 1, form 1`
                        };
                    }
                    if (
                        (queryGrade.startsWith("grade") && Number(gradeNo) > 11) ||
                        (queryGrade.startsWith("form") && Number(gradeNo) > 4) ||
                        (queryGrade.startsWith("pp") && Number(gradeNo) > 2)
                    )
                        throw {
                            code: 400,
                            message:
                                queryGrade +
                                " is out of range. Supported range is" +
                                " pp1 to pp2, grade 1 to grade 11 and form 1 to form 4"
                        };
                    logger.debug("Setting grade to " + queryGrade);
                    query.grade = <Grades>queryGrade;
                    break;
                case "index":
                    let indexQuery = String(req.query?.index);
                    let returnIndex: string[] = [],
                        errIndex = [];
                    // adm is a string since some schools have string characters
                    //@ts-ignore
                    returnIndex = indexQuery
                        .split(",")
                        .filter(index => !!index)
                        .map(index => {
                            if (isNaN(Number(index)) || index.length < 7) {
                                errIndex.push(index);
                                return;
                            }
                            return String(index.trim());
                        });
                    returnIndex = returnIndex.filter(x => x);

                    if (errIndex.length > 0)
                        throw {
                            code: 400,
                            message: "Invalid Index number",
                            cause: "Index number supplied, " + req.query.index + ", were invalid."
                        };
                    logger.debug("Setting index(s) to " + returnIndex.join(" ,"));
                    // Always and array of adm
                    query.indexNo = returnIndex;
                    break;
                case "upi":
                case "birthCertificateNo":
                    let bCertOrUpi = String(req.query[queryKeys[key]]);
                    if (!bCertOrUpi) break;
                    if (!bCertOrUpi.match(",")) {
                        query.birthCertOrUpi = [bCertOrUpi.trim()];
                        break;
                    }
                    let returnBirthCertOrUpi: string[] = [],
                        errBirthCertNo: string | any[] = [];
                    // adm is a string since some schools have string characters
                    returnBirthCertOrUpi = bCertOrUpi
                        .split(",")
                        .filter(x => !!x)
                        .map(x => String(x.trim()));
                    if (errBirthCertNo.length > 0)
                        throw {
                            code: 400,
                            message: "Invalid Birth Certificate Number or Upi",
                            cause:
                                "Birth Certificate Number or Upi supplied, " +
                                errBirthCertNo +
                                ", were invalid."
                        };
                    logger.debug("Setting birthCertOrUpi(s) to " + returnBirthCertOrUpi.join(" ,"));
                    // Always and array of adm
                    query.birthCertOrUpi = returnBirthCertOrUpi;
                    break;
            }
        }
        logger.debug("Setting query params");
        logger.debug(query);
        req.queryParams = query;
        next();
    } catch (err: any) {
        req.sendResponse.error(
            err.code || 500,
            err.message || "Internal server error",
            err.cause || ""
        );
    }
};*!/
export {
    allowedParameters
}
*/
