/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { Request } from "express";
import learner from "@database/learner";
import CustomError from "@libs/error_handler";
import { NemisWebService } from "@libs/nemis";
import LearnerHandler from "@libs/nemis/learner_handler";
import { Grade } from "../../../types/nemisApiTypes/institution";
import {
    Learner,
    LearnerDocument,
    ListAdmittedLearners,
    ListLearners,
    Results,
    SearchLearner
} from "../../../types/nemisApiTypes/learner";
import NemisApi from "@libs/nemis/api_handler";
import NemisApiService from "@libs/nemis/api_handler";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { uniqueIdentifierSchema } from "@libs/zod_validation";
import { Z_INDEX_NUMBER, Z_NUMBER_STRING } from "@libs/constants";
import { z } from "zod";
import { Promise } from "mongoose";

export default class Nemis {
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
            .transform(val => [val.indexNo, val.upiOrBirthCertificate] as const)
    };

    constructor(req: Request) {
        this.request = req;
        this.institution = req.institution;
        this.urlPath = req.path;
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
                    'Success, learner found.'
                );
            }
            if (!!indexResults || !!upiResults) {
                return this.request.respond.sendResponse(
                    indexResults ?? upiResults,
                    'Success, learner found.'
                );
            }
            throw new CustomError(`No learner was found`);
        } catch (err: any) {
            sendErrorMessage(this.request, err);
        }
    }

    async captureContinuingLearner() {
        try {
            // Get continuing learners to capture
            let continuingLearners = await learner.find({
                continuing: true, // Only admit joining learners,
                institutionId: this.request.institution._id,
                birthCertificateNo: { $exists: true, $nin: [null, undefined, 0, ''] },
                upi: { $exists: false, $in: [null, undefined, 0, ''] },
                dob: { $exists: true },
                reported: { $ne: true },
                archived: false
            });

            if (continuingLearners.length === 0) {
                throw new CustomError(
                    'No valid continuing learners to capture in the database. Please check if all learner have birth certificate numbers before continuing',
                    403
                );
            }
            // Get all grades to query list learner
            let listGrades = [...new Set(continuingLearners.map(x => x.grade))];

            // list learners

            let listLearner = await Promise.allSettled(
                listGrades.map(
                    grade =>
                        // @ts-ignore
                        new Promise(async (resolve, reject) => {
                            try {
                                await new NemisWebService().login(
                                    this.request.institution.username,
                                    this.request.institution.password
                                ); // Use the last cookie
                                resolve(new LearnerHandler().listLearners(grade));
                            } catch (err) {
                                reject(err);
                            }
                        })
                )
            );

            let mappedListLearner: { [K in Grade]?: ListLearners } = {};
            // @ts-ignore
            listLearner.forEach((list, i) => {
                Object.assign(mappedListLearner, {
                    [listGrades[i]]:
                        list.status === 'fulfilled'
                            ? list.value
                            : list.reason instanceof CustomError
                            ? list.reason
                            : new CustomError(
                                  list.reason.message || ' An error parsing list of captured learners',
                                  500
                              )
                });
            });

            // Check if any of the continuing learners has a UPI number
            let updateLearner = [] as LearnerDocument[];
            let learnerToCapture = [] as typeof continuingLearners;

            for (let i = 0; i < continuingLearners.length; i++) {
                let gradeListLearner = mappedListLearner[continuingLearners[i].grade];

                if (!Array.isArray(gradeListLearner)) {
                    continue;
                }

                let foundLearnerUpi = gradeListLearner.find(
                    x => continuingLearners[i].birthCertificateNo === x.birthCertificateNo
                );

                if (foundLearnerUpi) {
                    updateLearner.push(
                        Object.assign(continuingLearners[i], {
                            upi: foundLearnerUpi.upi,
                            admitted: true,
                            reported: true,
                            error: null
                        })
                    );
                    continue;
                }
                learnerToCapture.push(continuingLearners[i]);
            }

            // Since we might have transfers in the capturing list, use nemis API to check if to capture or this.requestuest transfer

            let apiResponsePromise = await Promise.allSettled(
                learnerToCapture.map(learner =>
                    learner.birthCertificateNo
                        ? new NemisApi().searchLearner(learner.birthCertificateNo)
                        : Promise.reject(new Error('Learner has no birth certificate in the database.'))
                )
            );

            let captureLearner = [] as [LearnerDocument, SearchLearner][];
            let transferLearner = [] as typeof captureLearner;
            // @ts-ignore
            apiResponsePromise.forEach((apiResponse, index) => {
                if (apiResponse.status === 'fulfilled') {
                    let res = apiResponse.value;
                    let learner = learnerToCapture[index];

                    switch (true) {
                        // Not a learner
                        case res.learnerCategory?.code === '0': {
                            captureLearner.push([learner, apiResponse.value]);
                            break;
                        }

                        // Current learner
                        case res.learnerCategory?.code === '1': {
                            let curInst = res.currentInstitution;
                            let institutionNemisData = this.request.institution?.nemisInstitutionData;
                            if (!institutionNemisData)
                                throw new Error('Institution has no valid data from NEMIS');
                            if (!curInst.level || !curInst.code) {
                                captureLearner.push([learner, res]);
                                break;
                            }
                            // If learner is admitted in thi school, update
                            if (curInst.code === this.request.institution.username) {
                                updateLearner.push(
                                    Object.assign(learner, {
                                        upi: res.upi || undefined,
                                        admitted: true,
                                        reported: !!res.upi,
                                        error: undefined,
                                        nhifNNo: res.nhifNo || undefined
                                    })
                                );
                                break;
                            }

                            // If institution is of lower level than this institution, use capture learner
                            // 'ECDE' < 'Primary' < 'Secondary' < 'TTC' < 'TVET' < 'JSS' < 'A-Level' < 'Pre-vocational'
                            if (curInst.level < String(institutionNemisData.educationLevel?.code)) {
                                captureLearner.push([learner, res]);
                                break;
                            }

                            // If both institutions are at the same level
                            if (curInst.level === String(institutionNemisData.educationLevel?.code)) {
                                // Use Regexp to check how many names match
                                let regexName = learner.name.match(
                                    new RegExp(res?.name?.replaceAll(' ', '|') ?? '', 'gi')
                                );

                                // if api learner's gender is the same as learner, and at least two names are the same; transfer learner
                                if (res.gender === learner.gender && regexName && regexName.length > 1)
                                    transferLearner.push([learner, res]);
                                // Else capture error
                                else
                                    Object.assign(learner, {
                                        error: `learner birth certificate is in use by another learner; ${
                                            res.name
                                        }, ${res.gender}, ${res.upi || ''} at ${curInst}`
                                    });

                                break;
                            }
                            // verify if it is possible to capture higher level learners
                            captureLearner.push([learner, res]);
                            break;
                        }

                        // Alumni
                        case res.learnerCategory?.code === '2': {
                            captureLearner.push([learner, res]);
                            break;
                        }
                    }
                } else {
                    Object.assign(learner, {
                        error: apiResponse.reason.message
                    });
                }
            });

            await new NemisWebService().login(
                this.request.institution.username,
                this.request.institution.password
            );

            let captureBiodataPromises = await Promise.allSettled(
                captureLearner.map(
                    learner => new LearnerHandler().addContinuingLearner(learner[0]) // New class instance to avoid state conflict
                )
            );

            // If we have learner to transfer, check if leaner wants us to handle transfers at this endpoint.
            // If not, return transfer learners as an error reporting where they are currently captured.
            if (transferLearner.length > 0) {
                if (this.request.params?.transfer) {
                    // Get cookie to use while creating new instances of NemisWebService
                    let transfers = await Promise.allSettled(
                        transferLearner.map(
                            learner =>
                                // @ts-ignore
                                new Promise(async (resolve, reject) => {
                                    try {
                                        await new NemisWebService().login(
                                            this.request.institution.username,
                                            this.request.institution.password
                                        );
                                        let transferred = await new LearnerHandler().transferIn(learner[0]);
                                        transferred ? resolve(true) : reject(false);
                                    } catch (err) {
                                        reject(err);
                                    }
                                })
                        )
                    );

                    transferLearner.forEach((transfer, i) => {
                        let transferred = transfers[i].status === 'fulfilled';
                        if (transferred) {
                            // Leave admitted and reported as undefined to only be set when learner has been released from the current institution
                            Object.assign(transfer[0], {
                                transfer: {
                                    out: false, //True if transferring out false when transferring in
                                    institution: {
                                        code: transfer[1].currentInstitution.code,
                                        name: transfer[1].currentInstitution.name
                                    }
                                },
                                upi: transfer[1].upi,
                                error: `Transfer this.requestuest saved. Learner awaits to be release from ${transfer[1].currentInstitution.name}, ${transfer[1].currentInstitution.code}`
                            });
                        } else {
                            Object.assign(transfer[0], {
                                error: `Transfer this.requestuest failed. Learner is admitted at ${transfer[1].currentInstitution.name}, ${transfer[1].currentInstitution.code} with UPI:${transfer[1]?.upi}`
                            });
                        }
                        updateLearner.push(transfer[0]);
                    });
                } else {
                    transferLearner.forEach(learner => {
                        Object.assign(learner[0], {
                            admitted: false,
                            reported: false,
                            upi: undefined,
                            error: `Learner is admitted at ${learner[1]?.currentInstitution?.name}, ${learner[1]?.currentInstitution?.code} with UPI:${learner[1]?.upi}. Use the transfer endpoint to transfer learner.`
                        });
                        updateLearner.push(learner[0]);
                    });
                }
            }
            // Return an update for each continuingLearner
            // @ts-ignore
            captureBiodataPromises.forEach((res, index) => {
                let learner = captureLearner[index];
                if (res.status === 'fulfilled') {
                    Object.assign(learner[0], {
                        admitted: true,
                        reported: true,
                        upi: res.value?.upi,
                        error: undefined
                    });
                    updateLearner.push(learner[0]);
                } else {
                    Object.assign(learner[0], {
                        reported: false,
                        error: res.reason?.message || 'Error while capturing learner biodata'
                    });
                    updateLearner.push(learner[0]);
                }
            });

            // Update learner without birth certificate number error to reflect it
            await learner.updateMany(
                {
                    institutionId: this.request.institution._id,
                    continuing: true,
                    birthCertificateNo: { $in: [null, undefined, ''] },
                    error: { $in: [null, undefined, ''] }
                },
                { error: 'Learner has no birth certificate number.' }
            );

            if (updateLearner.length > 0) await Promise.all(updateLearner.map(x => x.save()));

            // Get errors saved in the database
            let learnerErrors = await learner.find({
                institutionId: this.request.institution._id,
                error: { $nin: [null, undefined, '', 0], $type: 'string' }
            });

            this.request.respond.sendResponse(
                learnerErrors.length > 0 ? learnerErrors : updateLearner,
                `Operation completed successfully ${learnerErrors.length > 0 ? 'with below errors' : ''}`
            );
        } catch (err: any) {
            sendErrorMessage(this.request, err);
        }
    }

    async captureSingleContinuingLearner() {
        try {
            let uniqueIdentifier = uniqueIdentifierSchema.parse(this.request.params?.uniqueIdentifier);

            let learnerToCapture = await learner.findOne({
                $or: [{ birthCertificateNo: { $eq: uniqueIdentifier } }, { adm: { $eq: uniqueIdentifier } }],
                institutionId: this.request.institution._id,
                continuing: true,
                archived: false
            });

            if (!learnerToCapture) {
                throw new CustomError(
                    'There are no valid learners to capture. Please add learners to the database before continuing.',
                    400,
                    'no_valid_learner_to_capture'
                );
            }

            if (learnerToCapture.hasReported) {
                this.request.respond.sendResponse(
                    learnerToCapture,
                    'Learner has already reported to your institution.'
                );
                return;
            }

            if (!learnerToCapture.birthCertificateNo) {
                if (!learnerToCapture.error) {
                    learnerToCapture.error = 'Learner has no birth certificate number.';
                    await learnerToCapture.save();
                }

                this.request.respond.sendResponse(
                    learnerToCapture,
                    'Learner has has no birth certificate number.'
                );
                return;
            }

            let nemisApi = await Promise.allSettled([
                new NemisApi().searchLearner(encodeURI(learnerToCapture.birthCertificateNo))
            ]);

            let searchApiResults = undefined as SearchLearner | undefined;
            let capture = false;

            let apiResponse = nemisApi[0];
            const institutionNemisData = this.request.institution.nemisInstitutionData;
            if (apiResponse.status === 'fulfilled') {
                let res = apiResponse.value;

                switch (true) {
                    // Not a learner
                    case res.learnerCategory?.code === '0': {
                        capture = true;
                        break;
                    }

                    // Current learner
                    case res.learnerCategory?.code === '1': {
                        let curInst = res.currentInstitution;
                        if (!curInst.level || !curInst.code) {
                            capture = true;
                            break;
                        }
                        // If learner is admitted in thi school, update
                        if (curInst.code === this.request.institution.username) {
                            Object.assign(learnerToCapture, {
                                upi: res.upi || undefined,
                                admitted: true,
                                reported: !!res.upi,
                                error: undefined,
                                nhifNNo: res.nhifNo || undefined
                            });
                            break;
                        }

                        // If institution is of lower level than this institution, use capture learner
                        // 'ECDE' < 'Primary' < 'Secondary' < 'TTC' < 'TVET' < 'JSS' < 'A-Level' < 'Pre-vocational'
                        if (curInst.level < String(institutionNemisData?.educationLevel?.code)) {
                            capture = true;
                            break;
                        }

                        // If both institutions are at the same level
                        if (curInst.level === String(institutionNemisData?.educationLevel?.code)) {
                            // Use Regexp to check how many names match
                            let regexName = learnerToCapture.name.match(
                                new RegExp(res.name?.replaceAll(' ', '|') ?? '', 'gi')
                            );

                            // if api learner's gender is not the same as learner, or less than two names match; capture error
                            if (res.gender !== learnerToCapture.gender) {
                                Object.assign(learnerToCapture, {
                                    error: `learner birth certificate is in use by another learner; ${
                                        res.name
                                    }, ${res.gender}, ${res.upi || ''} at ${curInst}`
                                });
                                break;
                            }
                            if (!regexName || regexName?.length < 2) {
                                Object.assign(learnerToCapture, {
                                    error: `Provided learners\' name does not math with those returned by the Nemis API; ${
                                        res.name
                                    }, ${res.gender}, ${res.upi || ''} at ${curInst}`
                                });
                            }

                            // Else capture learner
                            else searchApiResults = res;
                            break;
                        }
                        // verify if it is possible to capture higher level learners
                        capture = true;
                        break;
                    }

                    // Alumni
                    case res.learnerCategory?.code === '2': {
                        capture = true;
                        break;
                    }
                }
            } else {
                capture = true;
            }

            let nemis = new NemisWebService();

            // If we can transfer learner, send result  for the user to decide if to transfer
            if (searchApiResults) {
                // If user wants usr to handle transfers at this end point
                if (this.request.params?.transfer) {
                    await nemis.login(this.request.institution.username, this.request.institution.password);

                    let transferred = await new LearnerHandler().transferIn(learnerToCapture);
                    if (transferred) {
                        Object.assign(learnerToCapture, {
                            transfer: {
                                out: false, //True if transferring out false when transferring in
                                institution: {
                                    code: searchApiResults.currentInstitution.code,
                                    name: searchApiResults.currentInstitution.name
                                }
                            },
                            upi: searchApiResults.upi,
                            error: `Transfer this.requestuest saved. Learner awaits to be release from ${searchApiResults.currentInstitution.name}, ${searchApiResults.currentInstitution.code}`
                        });
                    } else {
                        Object.assign(learnerToCapture, {
                            error: `Transfer this.requestuest failed. Learner is admitted at ${searchApiResults.currentInstitution.name}, ${searchApiResults.currentInstitution.code} with UPI:${searchApiResults?.upi}`
                        });
                    }

                    await learnerToCapture.save();
                    this.request.respond.sendResponse(
                        learnerToCapture,
                        learnerToCapture?.upi
                            ? 'Transfer this.requestuest saved. Learner awaiting release.'
                            : 'Learner transfer failed. See error for details.'
                    );

                    return;
                } else {
                    // Update  db with transfer results
                    Object.assign(learnerToCapture, {
                        admitted: false,
                        reported: false,
                        upi: undefined,
                        error: `Learner is admitted at ${searchApiResults?.currentInstitution?.name}, ${searchApiResults?.currentInstitution?.code} with UPI:${searchApiResults?.upi}. Use the transfer endpoint to transfer learner.`
                    });
                    await learnerToCapture.save();

                    this.request.respond.sendResponse(
                        learnerToCapture,
                        'Learner is currently captured in another institution, use transfer learner endpoint'
                    );
                    return;
                }
            }

            if (!capture) {
                await learnerToCapture.save();
                this.request.respond.sendResponse(
                    learnerToCapture,
                    'Learner failed to capture with error: ' + learnerToCapture.error
                );
                return;
            }

            await nemis.login(this.request.institution.username, this.request.institution.password);

            let captureBiodataPromise = await Promise.allSettled([
                new LearnerHandler().addContinuingLearner(learnerToCapture.toObject())
            ]);

            // Return an update for each continuingLearner
            let res = captureBiodataPromise[0];

            if (res.status === 'fulfilled') {
                Object.assign(learnerToCapture, {
                    admitted: true,
                    reported: true,
                    upi: res.value?.upi,
                    error: undefined
                });
            } else {
                Object.assign(learnerToCapture, {
                    reported: false,
                    error: res.reason?.message || 'Error while capturing learner biodata'
                });
            }

            // Save changes made to learner
            await learnerToCapture.save();

            this.request.respond.sendResponse(
                learnerToCapture,
                `Learner capture completed  ${learnerToCapture.error ? 'with below errors' : 'successfully'}`
            );
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }

    async captureJoiningLearner() {
        try {
            // Get learner who aren't captured from the database
            const learnerNotCaptured = await learner
                .find({
                    continuing: false, // Only admit joining learners,
                    institutionId: this.request.institution._id,
                    indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
                    admitted: true,
                    upi: { $exists: false, $in: [null, undefined, 0, ''] },
                    birthCertificateNo: { $exists: true, $nin: [null, undefined, 0, ''] },
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
            let listCapturedLearners = (await learnerHandler.listLearners('form 1')) ?? [];

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
                            new CustomError('Learner is not admitted yet', 400)
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
                    if (x.status === 'fulfilled') {
                        // @ts-ignore
                        let value = x.value as [(typeof learnerNotCaptured)[number], CaptureBiodataResponse];

                        value[0].upi = value[1].upi;
                        value[0].error = undefined;
                        value[0].hasReported = true;

                        return value[0].save();
                    } else {
                        let value = x.reason as [(typeof learnerNotCaptured)[number], CustomError];

                        value[0].error = value[1].message;

                        return value[0].save();
                    }
                })
            );

            // Check if we have learner without birth certificate and report to user before returning
            let learnerWithoutBCert = await learner.find({
                continuing: false, // Only admit joining learners,
                institutionId: this.request.institution._id,
                indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
                admitted: true,
                upi: { $exists: false, $in: [null, undefined, 0, ''] },
                birthCertificateNo: { $exists: false, $in: [null, undefined, 0, ''] },
                archived: false
            });

            if (learnerWithoutBCert.length > 0) {
                return this.request.respond.sendResponse(
                    learnerWithoutBCert.map(x => ({
                        ...x.toJSON,
                        error: 'Learner has no birth certificate assigned'
                    })),
                    'All learners have already been captured'
                );
            }
            return this.request.respond.sendResponse(
                [...results, ...learnerWithoutBCert],
                'All learners have already been captured'
            );
        } catch (err: any) {
            sendErrorMessage(this.request, err);
        }
    }

    async captureSingleJoiningLearner() {
        try {
            let uniqueIdentifier = uniqueIdentifierSchema.parse(this.request.params?.uniqueIdentifier);

            // Get learner who aren't captured from the database
            const learnerNotCaptured = await learner.findOne({
                continuing: false, // Only admit joining learners,
                institutionId: this.request.institution._id,
                indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
                admitted: true,
                birthCertificateNo: { $exists: true, $nin: [null, undefined, 0, ''] },
                dob: { $exists: true },
                $or: [{ birthCertificateNo: { $eq: uniqueIdentifier } }, { adm: { $eq: uniqueIdentifier } }],
                archived: false
            });

            if (!learnerNotCaptured) {
                throw new CustomError(
                    'Learner is either not captured or admitted. Capture learner to the API then admit before calling this end point',
                    400
                );
            }

            // Report if learner has reported and has upi
            if (learnerNotCaptured?.upi && learnerNotCaptured?.hasReported) {
                this.request.respond.sendResponse(
                    learnerNotCaptured,
                    "Learner' bio-data has already been captured."
                );
                return;
            }
            // Get list of captured learners frm Nemis website
            let nemis = new NemisWebService();
            let cookie = await nemis.login(
                this.request.institution.username,
                this.request.institution.password
            );
            const learnerHandler = new LearnerHandler();
            let listCapturedLearners = await learnerHandler.listLearners(learnerNotCaptured.grade);

            // Check if learner is already captured
            let listLearner = listCapturedLearners
                ? listCapturedLearners.find(
                      x => x.birthCertificateNo === learnerNotCaptured.birthCertificateNo
                  )
                : undefined;

            // If learner has already been captured, send response and return
            if (listLearner) {
                Object.assign(learnerNotCaptured, {
                    reported: true,
                    upi: listLearner.upi,
                    error: undefined
                });
                await learnerNotCaptured.save();
                this.request.respond.sendResponse(
                    learnerNotCaptured,
                    "Learner's bio-data was already captured."
                );
                return;
            }

            // Capture learners bio-data if not captured
            // Match learnerToCapture with respective postback
            let admittedLearner = await learnerHandler.listAdmittedJoiningLearners();

            let admitted = admittedLearner.find(x => x.indexNo === learnerNotCaptured.indexNo);
            if (!admitted) {
                Object.assign(learnerNotCaptured, { admitted: false });
                await learnerNotCaptured.save();
                throw new CustomError(
                    'Learner is not yet admitted to NEMIS. Make sure learner is admitted before trying to capture bio-data',
                    400
                );
            }

            // Capture bio-data for the filtered learners
            let res = await Promise.allSettled([
                new LearnerHandler().captureJoiningBiodata(learnerNotCaptured.toObject(), admitted)
            ]);

            // Update database with any errors and upi's captured
            if (res[0].status === 'fulfilled') {
                Object.assign(learnerNotCaptured, {
                    upi: res[0].value?.upi,
                    reported: true,
                    error: undefined
                });
            } else {
                Object.assign(learnerNotCaptured, {
                    reported: false,
                    error: res[0].reason?.message || 'Capture bio-data failed with unhandled error'
                });
            }

            await learnerNotCaptured.save();

            this.request.respond.sendResponse(
                learnerNotCaptured,
                res[0].status === 'fulfilled'
                    ? "Learner' bio-data was captured successfully"
                    : "There was an error encountered while trying to capture learner' Bio data"
            );
        } catch (err: any) {
            sendErrorMessage(this.request, err);
        }
    }

    async admitJoiningLearner() {
        try {
            let learnersToAdmit = await learner
                .find({
                    continuing: false, // Only admit joining learners
                    institutionId: this.request.institution._id,
                    indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
                    admitted: { $in: [null, false] },
                    archived: false
                })
                .sort({ birthCertificateNo: 'asc' })
                .lean();

            // Learner to admit should be an array of learners or an empty array if no learner is found
            if (Array.isArray(learnersToAdmit) && learnersToAdmit.length === 0)
                throw new CustomError(
                    'There are no valid learners to admit. Please add learners to the database before continuing.',
                    400,
                    'no_valid_learner_to_admit'
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
                    x.isAdmitted ? learner.updateOne({ _id: x._id }, x) : Promise.resolve()
                )
            );

            if (learnersNotAdmitted.length === 0) {
                this.request.respond.sendResponse(learnersToAdmit, 'All learners are already admitted.');
                return;
            }

            // Send cookie to be used to initialize new nemis instance for each leanerWithoutUpi
            let admissionResults = await Promise.allSettled(
                learnersNotAdmitted.map(learner => this.admitLearner(new LearnerHandler(), learner))
            );
            // @ts-ignore
            admissionResults.map((x, i) => {
                if (x.status === 'rejected') {
                    learnersNotAdmitted[i].isAdmitted = false;

                    learnersNotAdmitted[i].error = x.reason.message ?? 'Unknown error';
                } else {
                    learnersNotAdmitted[i].isAdmitted = true;
                    learnersNotAdmitted[i].error = undefined;
                }
            });

            await Promise.all(
                learnersNotAdmitted.map(x =>
                    x.isAdmitted ? learner.updateOne({ _id: x._id }, x) : Promise.resolve()
                )
            );

            this.request.respond.sendResponse(learnersNotAdmitted);
            return;
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }

    async admitSingleJoiningLearner() {
        try {
            let uniqueIdentifier = uniqueIdentifierSchema.parse(this.request.params?.uniqueIdentifier);

            let learnerToAdmit = await learner.findOne({
                $or: [{ birthCertificateNo: uniqueIdentifier }, { adm: uniqueIdentifier }],
                institutionId: this.request.institution._id,
                indexNo: { $nin: [null, undefined, 0, ''] }, // Learner must have an index number
                continuing: false,
                archived: false
            });
            if (!learnerToAdmit || typeof learnerToAdmit !== 'object') {
                throw new CustomError(
                    'There are no valid learners to admit. Please add learners to the database before continuing.',
                    400,
                    'no_valid_learner_to_admit'
                );
            }
            if (learnerToAdmit.isAdmitted) {
                this.request.respond.sendResponse(learnerToAdmit, 'Learner has already been admitted.');
                return;
            }

            // Initialize NEMIS module and login
            await new NemisWebService().login(
                this.request.institution?.username,
                this.request.institution?.password
            );
            let learnerHandler = new LearnerHandler();

            try {
                await this.admitLearner(learnerHandler, learnerToAdmit);
                learnerToAdmit.isAdmitted = true;
                learnerToAdmit.error = undefined;
            } catch (err: any) {
                learnerToAdmit.isAdmitted = false;
                learnerToAdmit.error = err.message ?? 'Unknown error';
            }

            await learner.updateOne({ _id: learnerToAdmit._id }, learnerToAdmit);

            this.request.respond.sendResponse(learnerToAdmit);
            return;
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }

    async admitLearner(learnerHandler: LearnerHandler, learner: Learner) {
        try {
            if (!learner?.indexNo) {
                throw new CustomError(
                    'Learner has no index number. Please update learner to include an index number',
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

            let matchedName = learner.name
                .match(new RegExp(results.name.replaceAll(' ', '|'), 'gi'))
                ?.filter(x => !!x);

            if (!matchedName) {
                throw new CustomError('learner has no matching name to that returned by the Api', 400);
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
