/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { Request } from "express";
import learnerModel from "@database/learner";
import CustomError from "@libs/error_handler";
import LearnerHandler from "@libs/nemis/learner_handler";
import Learner_handler from "@libs/nemis/learner_handler";
import {
    CaptureBiodata,
    Learner,
    ListAdmittedLearners,
    ListLearners,
    Results,
    SearchLearner
} from "../../../types/nemisApiTypes/learner";
import NemisApiService from "@libs/nemis/api_handler";
import { sendErrorMessage } from "../utils/middleware_error_handler";
import { Z_GRADE, Z_INDEX_NUMBER, Z_NUMBER_STRING, Z_STRING } from "@libs/constants";
import { z } from "zod";
import { Z_STRING_TO_ARRAY } from "../constants";
import { NemisWebService } from "@libs/nemis";
import { sync } from "@libs/sync_api_database";
import { Promise } from "mongoose";
import { dateTime } from "@libs/converts";

export default class Nemis {
    respond;
    private readonly request: Request;
    private readonly institution;
    private readonly urlPath;
    private validation = {
        searchLearner: z
            .object({
                indexNo: Z_NUMBER_STRING.refine(val => !!val).pipe(Z_INDEX_NUMBER),
                upiOrBirthCertificate: Z_NUMBER_STRING.refine(val => !!val)
            })
            .partial()
            .refine(val => val.indexNo || val.upiOrBirthCertificate, {
                message: `At least on search field must have a value, received indexNo: undefined and upiOrBirthCertificate:undefined}`
            })
            .transform(val => [val.indexNo, val.upiOrBirthCertificate] as const),
        captureContinuingParams: z
            .object({
                id: Z_NUMBER_STRING, // Learner's adm/index
                grade: Z_STRING_TO_ARRAY.pipe(z.array(Z_GRADE)),
                update: Z_STRING
            })
            .partial()
        
    };
    
    constructor(req: Request) {
        this.request = req;
        this.institution = req.institution;
        this.urlPath = req.path;
        this.respond = req.respond;
    }
    
    async searchLearner() {
        try {
            const [kcpeIndex, upiOrBirthCertificate] = this.validation.searchLearner.parse(
                this.request.query
            );
            const nemisApi = new NemisApiService();
            let resultsPromises: [Promise<Results> | undefined, Promise<SearchLearner> | undefined] =
                [] as any;
            
            if (kcpeIndex) resultsPromises[0] = nemisApi.results(kcpeIndex);
            if (upiOrBirthCertificate) resultsPromises[1] = nemisApi.searchLearner(upiOrBirthCertificate);
            
            let [indexResults, upiResults] = await Promise.all(resultsPromises);
            
            if (!!indexResults && !!upiResults) {
                return this.request.respond.sendResponse(
                    [indexResults, upiResults],
                    "Success, learner found."
                );
            }
            
            if (!!indexResults || !!upiResults) {
                return this.respond.sendResponse(indexResults ?? upiResults, "Success, learner found.");
            }
            throw new CustomError(`No learner was found`);
        } catch (err: any) {
            sendErrorMessage(this.request, err);
        }
    }
    
    async listLearners() {
        try {
            if (!this.request?.query?.grade || typeof this.request?.query?.grade ! == "string") {
                throw new CustomError("Grade was not specified or not a string.", 400, "Invalid grade was supplied.");
            }
            let grades = Z_STRING_TO_ARRAY.pipe(z.array(Z_GRADE)).parse(this.request.query.grade);
            
            if (!grades) throw new CustomError("list learner grade is is not defined");
            
            let supportedGrades = this.institution.nemisInstitutionData?.supportedGrades;
            if (!Array.isArray(supportedGrades))
                throw new CustomError(
                    "Supported grades is not an array. Please sync with the Nemis website to proceed.",
                    400
                );
            if (!grades.every(value => supportedGrades?.includes(value)))
                throw new CustomError(
                    "One of the provided grade is not supported by your institution. Check the selected grades before retrying.",
                    400
                );
            
            let listLearnerResults = grades.map(grade =>
                (async () => {
                    let learnerService = new LearnerHandler();
                    await learnerService.login(this.institution.username, this.institution.password);
                    return await learnerService.listLearners(grade);
                })()
            );
            
            let results: ListLearners = (await Promise.allSettled(listLearnerResults))
                .filter(
                    (val: PromiseSettledResult<Promise<ListLearners>>) =>
                        val.status === "fulfilled" && val.value
                )
                .flatMap((res: PromiseFulfilledResult<Promise<ListLearners>>) => res.value);
            
            this.respond.sendResponse(results, `${results.length} learners fetched successfully.`);
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }
    
    async requestJoiningLearner() {
        try {
            const requestData = this.request?.parsedExcel ?? Array.isArray(this.request.body) ? this.request.body as any[] : [this.request.body];
            
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }
    
    async admitJoiningLearner() {
        try {
            let learnersToAdmit = await learnerModel
                .find({
                    continuing: false, // Only admit joining learners
                    institutionId: this.request.institution._id,
                    indexNo: { $nin: [null, undefined, 0, ""] }, // Learner must have an index number
                    admitted: { $in: [null, false] },
                    archived: false
                })
                .sort({ birthCertificateNo: "asc" })
                .lean();
            
            // Learner to admit should be an array of learners or an empty array if no learner is found
            if (Array.isArray(learnersToAdmit) && learnersToAdmit.length === 0)
                throw new CustomError(
                    "There are no valid learners to admit. Please add learners to the database before continuing.",
                    400,
                    "no_valid_learner_to_admit"
                );
            
            // Initialize NEMIS module and login
            await new NemisWebService().login(
                this.request.institution?.username,
                this.request.institution?.password
            );
            
            // Use for await of to avoid view state conflict
            
            let admittedJoiningLearners = await new LearnerHandler().listAdmittedJoiningLearners();
            
            if (admittedJoiningLearners.length > 10)
                // Sort by Birth certificate number
                admittedJoiningLearners.sort((a, b) => (a.indexNo > b.indexNo ? 1 : -1));
            
            let learnersNotAdmitted: typeof learnersToAdmit = [];
            
            for (const learner of learnersToAdmit) {
                let filteredLearner = admittedJoiningLearners.filter(x => learner.indexNo === x.indexNo);
                if (filteredLearner.length === 1) {
                    learner.isAdmitted = true;
                    continue;
                }
                learnersNotAdmitted.push(learner);
            }
            
            // We update database here to save progress in case of an error
            await Promise.all(
                learnersToAdmit.map(x =>
                    x.isAdmitted ? learnerModel.updateOne({ _id: x._id }, x) : Promise.resolve()
                )
            );
            
            if (learnersNotAdmitted.length === 0) {
                this.request.respond.sendResponse(learnersToAdmit, "All learners are already admitted.");
                return;
            }
            
            // Send cookie to be used to initialize new nemis instance for each leanerWithoutUpi
            let admissionResults = await Promise.allSettled(
                learnersNotAdmitted.map(learner => this.admitLearner(new LearnerHandler(), learner))
            );
            // @ts-ignore
            admissionResults.map((x, i) => {
                if (x.status === "rejected") {
                    learnersNotAdmitted[i].isAdmitted = false;
                    
                    learnersNotAdmitted[i].error = x.reason.message ?? "Unknown error";
                } else {
                    learnersNotAdmitted[i].isAdmitted = true;
                    learnersNotAdmitted[i].error = undefined;
                }
            });
            
            await Promise.all(
                learnersNotAdmitted.map(x =>
                    x.isAdmitted ? learnerModel.updateOne({ _id: x._id }, x) : Promise.resolve()
                )
            );
            
            this.request.respond.sendResponse(learnersNotAdmitted);
            return;
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }
    
    async captureJoiningLearner() {
        try {
            // Get learner who aren't captured from the database
            const learnerNotCaptured = await learnerModel
                .find({
                    continuing: false, // Only admit joining learners,
                    institutionId: this.request.institution._id,
                    indexNo: { $nin: [null, undefined, 0, ""] }, // Learner must have an index number
                    admitted: true,
                    upi: { $exists: false, $in: [null, undefined, 0, ""] },
                    birthCertificateNo: { $exists: true, $nin: [null, undefined, 0, ""] },
                    dob: { $exists: true },
                    archived: false
                })
                .sort({ birthCertificateNo: 1 });
            
            // Get list of captured learners frm Nemis website
            let nemis = new NemisWebService();
            let cookie = await nemis.login(
                this.request.institution.username,
                this.request.institution.password
            );
            let learnerHandler = new LearnerHandler();
            let listCapturedLearners = (await learnerHandler.listLearners("form 1")) ?? [];
            
            // Sort to reduce search time
            if (listCapturedLearners.length > 10) {
                listCapturedLearners.sort((a, b) => a.birthCertificateNo.localeCompare(b.birthCertificateNo));
            }
            
            // Filter out learner who aren't captured on Nemis
            let learnerToCapture: typeof learnerNotCaptured = [];
            for (const learner of learnerNotCaptured) {
                let listLearner = listCapturedLearners.find(
                    x => x.birthCertificateNo === learner.birthCertificateNo
                );
                if (listLearner) {
                    learner.upi = listLearner.upi;
                    learner.hasReported = true;
                    learner.error = undefined;
                } else {
                    learnerToCapture.push(learner);
                }
            }
            
            // Update database to match with Nemis
            await Promise.all(learnerNotCaptured.map(x => (x.hasReported ? x.save() : Promise.resolve())));
            
            // Get list of admitted learner to get learner Postback values
            let learnerWithPostback = [] as unknown as [
                [(typeof learnerNotCaptured)[number], ListAdmittedLearners[number] | CustomError]
            ];
            
            if (learnerToCapture.length > 0) {
                // Match learnerToCapture with their respective postback
                let admittedLearner = await learnerHandler.listAdmittedJoiningLearners();
                
                for (let i = 0; i < learnerToCapture.length; i++) {
                    let admitted = admittedLearner.find(x => x.indexNo === learnerToCapture[i].indexNo);
                    if (admitted) {
                        learnerWithPostback.push([learnerToCapture[i], admitted]);
                    } else {
                        learnerWithPostback.push([
                            learnerToCapture[i],
                            new CustomError("Learner is not admitted yet", 400)
                        ]);
                    }
                }
            }
            
            // Capture bio-data for the filtered learners
            let captureResults = await Promise.allSettled(
                learnerWithPostback.map(learner => {
                    // @ts-ignore
                    return new Promise(async (resolve, reject) => {
                        if (learner[1] instanceof CustomError) {
                            reject([learner]);
                        } else {
                            new NemisWebService(cookie, nemis.getState());
                            let captureResults = await new LearnerHandler().captureJoiningBiodata(
                                learner[0].toObject(),
                                learner[1]
                            );
                            
                            resolve([learner[0], captureResults]);
                        }
                    });
                })
            );
            
            // Update database with any errors and upi's captured
            let results = await Promise.all(
                // @ts-ignore
                captureResults.map(x => {
                    if (x.status === "fulfilled") {
                        // @ts-ignore
                        let value = x.value as [(typeof learnerNotCaptured)[number], CaptureBiodataResponse];
                        
                        value[0].upi = value[1].upi;
                        value[0].error = undefined;
                        value[0].hasReported = true;
                        
                        return value[0].save();
                    } else {
                        let value = x.reason as [(typeof learnerNotCaptured)[number], CustomError];
                        
                        value[0].error = { message: value[1].message, timestamp: dateTime() };
                        
                        return value[0].save();
                    }
                })
            );
            
            // Check if we have learner without birth certificate and report to user before returning
            let learnerWithoutBCert = await learnerModel.find({
                continuing: false, // Only admit joining learners,
                institutionId: this.request.institution._id,
                indexNo: { $nin: [null, undefined, 0, ""] }, // Learner must have an index number
                admitted: true,
                upi: { $exists: false, $in: [null, undefined, 0, ""] },
                birthCertificateNo: { $exists: false, $in: [null, undefined, 0, ""] },
                archived: false
            });
            
            if (learnerWithoutBCert.length > 0) {
                return this.request.respond.sendResponse(
                    learnerWithoutBCert.map(x => ({
                        ...x.toJSON,
                        error: "Learner has no birth certificate assigned"
                    })),
                    "All learners have already been captured"
                );
            }
            return this.request.respond.sendResponse(
                [...results, ...learnerWithoutBCert],
                "All learners have already been captured"
            );
        } catch (err: any) {
            sendErrorMessage(this.request, err);
        }
    }
    
    async captureContinuingLearner() {
        try {
            let query = this.validation.captureContinuingParams.parse(this.request.query);
            
            console.debug("Syncing local database");
            await sync(this.institution);
            
            let mongoQuery: any = {
                institutionId: this.institution._id,
                "archived.isArchived": false,
                isContinuing: true, // Only admit joining learners,
                dob: { $exists: true },
                hasReported: { $ne: true },
                birthCertificateNo: { $exists: true, $nin: [null, undefined, 0, ""] },
                upi: { $exists: false }
            };
            
            const { id, grade, update } = query;
            
            if (grade?.includes("form 1"))
                throw new CustomError(
                    "You can't capture form one learners as as continuing learner. Use capture joining learner end point instead."
                );
            
            id &&
            Object.assign(mongoQuery, {
                $or: [{ birthCertificateNo: { $eq: id } }, { adm: { $eq: id } }]
            });
            
            if (grade)
                Object.assign(mongoQuery, {
                    grade: { $in: grade }
                });
            else
                Object.assign(mongoQuery, {
                    grade: {
                        $in: this.institution?.nemisInstitutionData?.supportedGrades.filter(
                            grade => grade !== "form 1"
                        )
                    }
                });
            
            // Ignore update if we don't have id
            if (update && id) {
                delete mongoQuery.hasReported;
                delete mongoQuery.upi;
            }
            
            let continuingLearners = await learnerModel.find(mongoQuery);
            // Check if we got any results from db
            if (continuingLearners.length === 0)
                throw new CustomError(
                    "No learner found to capture. Learner may have already been captured. Use view learner" +
                    " end-point to confirm learners status in the database. To update a learner send a request with learner's adm or " +
                    "birth certificate as id with update set to true.",
                    400
                );
            
            if (query.id) {
                // If user supplied id, validate if learner has already been captured\
                if (continuingLearners.length > 1)
                    throw new CustomError(
                        "The provided if admission number or birth certificate number returned more than one " +
                        "learner. Provide a more specific id to continue.",
                        400
                    );
                if (continuingLearners[0].grade === "form 1")
                    throw new CustomError(
                        "Form 1 learners can  not be " +
                        "captured as continuing learners. Use /admit_joining_learner to capture from one students"
                    );
                if (continuingLearners[0].hasReported && !query.update)
                    throw new CustomError(
                        "Learner has already been captured, to update, set update to true.",
                        400
                    );
            }
            
            console.info(`Initializing capture of ${continuingLearners.length} learners`);
            
            const { username, password } = this.institution;
            let capturePromises = continuingLearners.map(learner =>
                (async () => {
                    const learnerHandler = new Learner_handler();
                    await learnerHandler.login(username, password);
                    return learnerHandler.captureContinuing(learner);
                })()
            );
            
            console.debug("capturing learners");
            let captureResults: PromiseSettledResult<CaptureBiodata>[] = await Promise.allSettled(
                capturePromises
            );
            
            console.log("Processing results");
            
            let responseResults = captureResults.map((res, index: number) => {
                if (res.status === "fulfilled")
                    return Object.assign(continuingLearners[index], {
                        upi: res.value?.upi,
                        message: res.value?.message,
                        error: null
                    });
                return Object.assign(continuingLearners[index], {
                    error: { message: res.reason?.message, timestamp: dateTime() }
                });
            });
            
            let erroredLearners = [] as typeof responseResults;
            let successLearners = [] as typeof responseResults;
            
            responseResults.forEach(learner => {
                if (learner.error) erroredLearners.push(learner);
                else successLearners.push(learner);
            });
            
            console.warn(erroredLearners);
            console.info(successLearners);
            
            let results = successLearners.concat(erroredLearners);
            
            // Update database
            await Promise.allSettled(results.map(learner => learner.save()));
            
            this.respond.sendResponse(
                results,
                `${successLearners.length} learners were successfully captured with ${erroredLearners.length} errors.`
            );
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }
    
    async admitLearner(learnerHandler: LearnerHandler, learner: Learner) {
        try {
            if (!learner?.indexNo) {
                throw new CustomError(
                    "Learner has no index number. Please update learner to include an index number",
                    400
                );
            }
            let nemisApi = new NemisApiService();
            const [results, admission, reported] = await Promise.all([
                nemisApi.results(learner.indexNo),
                nemisApi.admission(learner.indexNo),
                nemisApi.reported(learner.indexNo, this.institution.username)
            ]);
            
            // Check how closely admitApiResponse matches to our learner
            if (results.gender !== learner.gender) {
                throw new CustomError(
                    "Learner's gender doesn't match up with that returned by the nemis API. Check index number",
                    401
                );
            }
            
            let matchedName =
                results.name &&
                learner.name.match(new RegExp(results.name.replaceAll(" ", "|"), "gi"))?.filter(x => !!x);
            
            if (!matchedName) {
                throw new CustomError("learner has no matching name to that returned by the Api", 400);
            }
            
            // if we matched more than one name skip checking marks
            if (matchedName.length < 2)
                if (results.marks && results?.marks !== String(learner.marks)) {
                    throw new CustomError("Learner's marks saved in the data", 400);
                }
            
            // Check if learner is admitted elsewhere
            
            if (reported) {
                // If admitted to another institution, check if learner is already captured
                if (reported.upi && reported?.upi?.length > 3) {
                    throw new CustomError(
                        `Learner has already been admitted and captured at ${reported.capturedBy}, ${reported.institution.name}`,
                        400
                    );
                }
            }
            
            // We can go ahead and admit if we haven't failed yet
            return await learnerHandler.admitJoiningLearner(learner, results, admission);
        } catch (err) {
            throw err;
        }
    }
}
