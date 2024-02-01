/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import {Request} from 'express';
import learnerModel from '@database/learner';
import CustomError from '@libs/error_handler';
import LearnerHandler from '@libs/nemis/learner_handler';
import Learner_handler from '@libs/nemis/learner_handler';
import {
    Learner,
    ListLearners,
    RequestedAndApprovedLearners,
    Results,
    SearchLearner
} from '../../../types/nemisApiTypes/learner';
import {Admission} from '../../../types/nemisApiTypes/api';
import NemisApiService from '@libs/nemis/api_handler';
import Api_handler from '@libs/nemis/api_handler';
import {sendErrorMessage} from '../utils/middleware_error_handler';
import {Z_GRADE, Z_INDEX_NUMBER, Z_NUMBER_STRING, Z_PARSE_SCHOOL_ADMITTED, Z_STRING} from '@libs/constants';
import {z} from 'zod';
import {Z_REQUEST_JOINING_lEARNERS, Z_STRING_TO_ARRAY} from '../constants';
import {sync} from '@libs/sync_api_database';
import {Promise} from 'mongoose';
import {dateTime} from '@libs/converts';
import Respond from '@controller/utils/send_response';
import {Browser} from 'puppeteer';

export default class Nemis {
    private readonly respond: Respond;
    private readonly request: Request;
    private readonly institution;
    private readonly urlPath;
    browser = undefined as undefined | Browser
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
            .partial(),
        requestJoiningLearner: Z_REQUEST_JOINING_lEARNERS
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
                    'Success, learner found.'
                );
            }

            if (!!indexResults || !!upiResults) {
                return this.respond.sendResponse(indexResults ?? upiResults, 'Success, learner found.');
            }
            throw new CustomError(`No learner was found`);
        } catch (err: any) {
            sendErrorMessage(this.request, err);
        }
    }

    async listLearners() {
        try {
            if (!this.request?.query?.grade || typeof this.request?.query?.grade! == 'string') {
                throw new CustomError(
                    'Grade was not specified or not a string.',
                    400,
                    'Invalid grade was supplied.'
                );
            }
            let grades = Z_STRING_TO_ARRAY.pipe(z.array(Z_GRADE)).parse(this.request.query.grade);

            if (!grades) throw new CustomError('list learner grade is is not defined');

            let supportedGrades = this.institution.nemisInstitutionData?.supportedGrades;
            if (!Array.isArray(supportedGrades))
                throw new CustomError(
                    'Supported grades is not an array. Please sync with the Nemis website to proceed.',
                    400
                );
            if (!grades.every(value => supportedGrades?.includes(value)))
                throw new CustomError(
                    'One of the provided grade is not supported by your institution. Check the selected grades before retrying.',
                    400
                );
// todo: rewrite for puppeteer
            let listLearnerResults = grades.map(grade =>
                (async () => {
                    let learnerService = new LearnerHandler();
                    await learnerService.init()
                    this.browser = learnerService.browser
                    await learnerService.login(this.institution.username, this.institution.password);
                    return await learnerService.listLearners(grade);
                })()
            );

            let results: ListLearners = (await Promise.allSettled(listLearnerResults))
                .filter(
                    (val: PromiseSettledResult<Promise<ListLearners>>) =>
                        val.status === 'fulfilled' && val.value
                )
                .flatMap((res: PromiseFulfilledResult<Promise<ListLearners>>) => res.value);

            this.respond.sendResponse(results, `${results.length} learners fetched successfully.`);
        } catch (err) {
            sendErrorMessage(this.request, err);
        }
    }

    async requestJoiningLearner() {
        try {
            let requestData: any[] = [];

            if (this.request.url.toLowerCase().endsWith('excel')) requestData = this.request?.parsedExcel;
            else if (this.request.url.toLowerCase().endsWith('json')) {
                if (Array.isArray(this.request.body)) requestData = this.request.body as any[];
                else requestData = [this.request.body];
            } else {
                // get data from database
                let results = await learnerModel
                    .find({
                        institutionId: this.institution._id,
                        isAdmitted: false,
                        isContinuing: false,
                        'archived.isArchived': false
                    })
                    .lean();

                if (results.length > 0)
                    results.forEach(val => {
                        let contacts = val.contactDetails;
                        let requestObj = {
                            name: val.name,
                            id: contacts?.father?.id || contacts?.mother?.id || contacts?.guardian?.id,
                            requestedBy: `Requested by parent / guardian with id ${
                                contacts?.father?.id || contacts?.mother?.id || contacts?.guardian?.id
                            }`,
                            indexNo: val?.indexNo,
                            tel: contacts?.father?.tel || contacts?.mother?.tel || contacts?.guardian?.tel,
                            adm: val.adm
                        };

                        if (Object.values(requestObj).includes(undefined)) return;
                        else requestData.push(requestObj);
                    });
                else throw new CustomError('There are no valid learner to request in the database', 400);
            }

            if (!Array.isArray(requestData))
                throw new CustomError('Failed to parse provided data', 400, 'Data is not of type array');

            // Validate user data
            let learnersArray = this.validation.requestJoiningLearner.parse(requestData);

            // Get list of already requested learners
            const learnerService = new LearnerHandler();

            await learnerService.init();
            this.browser = await learnerService.browser

            await learnerService.login(this.institution.username, this.institution.password);

            //@todo: check if we can request early and throw error

            const requestedLearners = [] as Array<RequestedAndApprovedLearners>;

            requestedLearners.push(await learnerService.getRequestedJoiningLearners());
            requestedLearners.push(await learnerService.getApprovedJoiningLearners());

            let requestedApprovedLearners = requestedLearners.flat();

            // Filter already requested learners
            let matchedLearner = [] as Array<
                (typeof learnersArray)[number] & {
                requestResults: RequestedAndApprovedLearners[number];
            }
            >;
            let requestLearners = learnersArray.filter(
                learner =>
                    !requestedApprovedLearners.some(val => {
                        if (val.indexNo === learner.indexNo) {
                            matchedLearner.push({...learner, requestResults: val});
                            return true;
                        }
                    })
            );

            // Return if all learners have been requested
            if (requestLearners.length === 0) {
                return this.respond.sendResponse(
                    matchedLearner,
                    'All learner(s) have already been requested.'
                );
            }

            // Get API response for the remainder learners
            const nemisApiService = new NemisApiService();

            //@todo:check if learner has reported

            let reportingStatus: Array<Awaited<PromiseSettledResult<Admission>>> = await Promise.allSettled(
                requestLearners.map(learner => nemisApiService.admission(learner.indexNo))
            );

            let erroredLearners = [] as Array<(typeof requestLearners)[number] & { error: string | Error }>;

            let requestLearnersWithResults = [] as Array<(typeof requestLearners)[number]>;

            reportingStatus.forEach((val, i) => {
                if (val.status === 'fulfilled')
                    if (val.value?.schoolAdmitted.includes(this.institution.nemisInstitutionData!.knecCode!))
                        return;
                    //@todo: check gender aganist school gender
                    else requestLearnersWithResults.push(requestLearners[i]);
                else erroredLearners.push({...requestLearners[i], error: val.reason.message});
            });

            // Request learners
            for await (const learner of requestLearnersWithResults) {
                try {
                    let message = await learnerService.requestJoiningLearner(learner);
                    Object.assign(learner, {
                        requested: {
                            success: true,
                            message: message
                        }
                    });
                } catch (err: any) {
                    erroredLearners.push(
                        Object.assign(learner, {
                            error: err.message
                        })
                    );
                }
            }

            this.respond.sendResponse([erroredLearners, requestLearnersWithResults, matchedLearner]);
        } catch (err) {
            if (this.browser) await this.browser.close();
            sendErrorMessage(this.request, err);
        }
    }

    async admitJoiningLearner() {
        try {
            let learnersToAdmit = await learnerModel
                .find({
                    institutionId: this.request.institution._id,
                    isContinuing: false, // Only admit joining learners
                    indexNo: {$nin: [null, undefined, 0, '']}, // Learner must have an index number
                    isAdmitted: {$in: [null, false]},
                    'archived.isArchived': false
                })
                .sort({birthCertificateNo: 'asc'})
                .lean();

            // Learner to admit should be an array of learners or an empty array if no learner is found
            if (Array.isArray(learnersToAdmit) && learnersToAdmit.length === 0)
                return this.respond.sendResponse(
                    [],
                    'There are no valid learners to admit. Please add learners to the database before continuing.'
                );

            // Initialize NEMIS module and login
            let learnerHandler = new LearnerHandler();

            await learnerHandler.init();

            this.browser = await learnerHandler.browser

            await learnerHandler.login(
                this.request.institution?.username,
                this.request.institution?.password
            );

            // Use for await of to avoid view state conflict
            let admittedJoiningLearners = await learnerHandler.listAdmittedJoiningLearners();

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
                    x.isAdmitted ? learnerModel.updateOne({_id: x._id}, x) : Promise.resolve()
                )
            );
            // Update database
            if (learnersNotAdmitted.length === 0) {
                await learnerHandler.close();
                this.request.respond.sendResponse(learnersToAdmit, 'All learners are already admitted.');
                return [undefined, learnersToAdmit];
            }

            let nemisApi = new Api_handler();

            let apiRes: Array<PromiseSettledResult<Admission>> = await Promise.allSettled(
                learnersNotAdmitted.map(learner => nemisApi.admission(learner.indexNo!))
            );

            let results = [],
                errors = [],
                i = 0;
            // Send cookie to be used to initialize new nemis instance for each leanerWithoutUpi
            for await (const learner of learnersNotAdmitted) {
                try {
                    let learnerApiRes = apiRes[i];
                    i++;

                    if (learnerApiRes.status === 'rejected') throw learnerApiRes.reason;

                    let value = learnerApiRes.value;
                    let selectedSchool = Z_PARSE_SCHOOL_ADMITTED.parse(value?.schoolAdmitted);

                    if (selectedSchool.code !== this.institution?.nemisInstitutionData?.knecCode)
                        throw new Error(`Learner has been selected at ${selectedSchool.originalString}`);
                    if (value.tot !== String(learner.marks)) throw new Error('Learner marks do not match, d');
                    await learnerHandler.admitJoiningLearner(learner);

                    results.push({...learner, admitted: true});
                } catch (err: any) {
                    errors.push({...learner, admitted: false, error: err.message});
                }
            }
            await learnerHandler.close();
            this.request.respond.sendResponse([errors, results]);
        } catch (err) {
            if (this.browser) await this.browser.close()
            sendErrorMessage(this.request, err);
        }
    }

    async captureJoiningLearner() {
        try {
            const errors: Array<any> = []
            // Get list of captured learners frm Nemis website
            let learnerHandler = new LearnerHandler();

            await learnerHandler.init();
            // Update browser so that we can close it in case we throw and error
            this.browser = learnerHandler.browser;

            await learnerHandler.login(this.request.institution.username, this.request.institution.password);

            let listLearners = await learnerHandler.listLearners('form 1')
            let admittedLearners = await learnerHandler.listAdmittedJoiningLearners();

            // Populate missing data on list learner
            let populatedListLearners: Array<[Learner, ListLearners[number]]> = []

            let populatePromise: Array<PromiseSettledResult<Learner>> = await Promise.allSettled(listLearners.map(val => learnerModel.findOne({
                institutionId: this.request.institution._id,
                birthCertificateNo: val.birthCertificateNo
            })))

            populatePromise.forEach((val, i) => {
                if (val.status === 'fulfilled')
                    populatedListLearners.push([val.value, listLearners[i]])
                else
                    errors.push({...listLearners[i], error: 'Learner was not found in the database'})

            })

            let captureLearner = admittedLearners.filter(val => !populatedListLearners.some((v => v[0].indexNo === val.indexNo)))
            if (captureLearner.length === 0) { // todo: send message here
               await  learnerHandler.close()
                return
            }

            let captureResults = []

            for await (const learner of captureLearner) {
                try {
                    let dbLearner = await learnerModel.findOne({
                        institutionId: this.request.institution._id,
                        indexNo: learner.indexNo
                    })
                    if (!dbLearner) throw new Error('Learner not save in the database.')

                    await learnerHandler.captureJoiningBiodata(dbLearner, learner);
                    captureResults.push({...learner, isAdmitted: true});

                } catch (err: any) {
                    errors.push({...learner, error: err.message});
                }
            }

            await learnerHandler.close();

            return this.request.respond.sendResponse(
                [errors, captureResults],
                'All learners have already been captured'
            );
        } catch (err: any) {
            if (this.browser) await this.browser.close();
            sendErrorMessage(this.request, err);
        }
    }

    async captureContinuingLearner() {
        try {
            let query = this.validation.captureContinuingParams.parse(this.request.query);

            console.debug('Syncing local database');
            await sync(this.institution);

            let mongoQuery: any = {
                institutionId: this.institution._id,
                'archived.isArchived': false,
                isContinuing: true, // Only admit joining learners,
                dob: {$exists: true},
                hasReported: {$ne: true},
                birthCertificateNo: {$exists: true, $nin: [null, undefined, 0, '']},
                upi: {$exists: false}
            };

            const {id, grade, update} = query;

            if (grade?.includes('form 1'))
                throw new CustomError(
                    "You can't capture form one learners as as continuing learner. Use capture joining learner end point instead."
                );

            id &&
            Object.assign(mongoQuery, {
                $or: [{birthCertificateNo: {$eq: id}}, {adm: {$eq: id}}]
            });

            if (grade)
                Object.assign(mongoQuery, {
                    grade: {$in: grade}
                });
            else
                Object.assign(mongoQuery, {
                    grade: {
                        $in: this.institution?.nemisInstitutionData?.supportedGrades.filter(
                            grade => grade !== 'form 1'
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
                    'No learner found to capture. Learner may have already been captured. Use view learner' +
                    " end-point to confirm learners status in the database. To update a learner send a request with learner's adm or " +
                    'birth certificate as id with update set to true.',
                    400
                );

            if (query.id) {
                // If user supplied id, validate if learner has already been captured\
                if (continuingLearners.length > 1)
                    throw new CustomError(
                        'The provided if admission number or birth certificate number returned more than one ' +
                        'learner. Provide a more specific id to continue.',
                        400
                    );
                if (continuingLearners[0].grade === 'form 1')
                    throw new CustomError(
                        'Form 1 learners can  not be ' +
                        'captured as continuing learners. Use /admit_joining_learner to capture from one students'
                    );
                if (continuingLearners[0].hasReported && !query.update)
                    throw new CustomError(
                        'Learner has already been captured, to update, set update to true.',
                        400
                    );
            }

            console.info(`Initializing capture of ${continuingLearners.length} learners`);

            const {username, password} = this.institution;
            let capturePromises = continuingLearners.map(learner =>
                (async () => {
                    const learnerHandler = new Learner_handler();
                    await learnerHandler.login(username, password);
                    return; // learnerHandler.captureContinuing(learner);
                })()
            );

            console.debug('capturing learners');
            let captureResults: PromiseSettledResult<any>[] = await Promise.allSettled(capturePromises);

            console.log('Processing results');

            let responseResults = captureResults.map((res, index: number) => {
                if (res.status === 'fulfilled')
                    return Object.assign(continuingLearners[index], {
                        upi: res.value?.upi,
                        message: res.value?.message,
                        error: null
                    });
                return Object.assign(continuingLearners[index], {
                    error: {message: res.reason?.message, timestamp: dateTime()}
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
}
