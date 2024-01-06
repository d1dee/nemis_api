/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */
import { z } from 'zod';
import {
    LEARNER_FIELDS,
    Z_DATE_TIME,
    Z_GENDER,
    Z_GRADE,
    Z_INDEX_NUMBER,
    Z_MEDICAL_CONDITION,
    Z_NAMES,
    Z_NATIONALITIES,
    Z_NUMBER,
    Z_NUMBER_STRING,
    Z_STRING, Z_STRING_TO_BOOLEAN,
    Z_TRANSFER_METHOD
} from "@libs/constants";
import { countyToNo, dateTime } from '@libs/converts';
import CustomError from '@libs/error_handler';

import { sendErrorMessage } from '../utils/middleware_error_handler';
import { Request } from 'express';
import learnerModel from '@database/learner';
import learner from '@database/learner';
import { sub } from 'date-fns';
import { sync } from '@libs/sync_api_database';
import { fromZodError } from 'zod-validation-error';
import { Z_PARENT_CONTACTS, Z_STRING_TO_ARRAY, Z_TRANSFER } from '../constants';
import {
    DefaultLearnerValidationFields,
    ExtraValidationFields,
    LearnerValidationFields,
    ValidLearner
} from '../../../types/nemisApiTypes/learner';

export default class Learner {
    private req;
    private sendResponse;

    private defaultRequiredFields = ['name', 'adm', 'grade'];
    private defaultExtraFields = ['contacts', 'county'] as const;
    private required: LearnerValidationFields = { name: true, adm: true, grade: true };

    private requiredExtras: ExtraValidationFields[] = [];

    public validations = {
        listLearnerQuery: z
            .object({
                limit: Z_NUMBER.multipleOf(10, 'Limit must be multiple of 10'),
                grade: Z_STRING_TO_ARRAY.pipe(z.array(Z_GRADE)),
                gender: Z_STRING_TO_ARRAY.pipe(z.array(Z_GENDER)),
                transferred: Z_STRING_TO_ARRAY.pipe(z.array(Z_TRANSFER_METHOD)),
                stream: Z_STRING_TO_ARRAY,
                withUpi: Z_STRING_TO_BOOLEAN,
                withError: Z_STRING_TO_BOOLEAN,
                isArchived: Z_STRING_TO_BOOLEAN,
                name: Z_STRING.min(3, 'Name string must be at least 3 letters long.'),
                age: Z_NUMBER.min(3, 'Minimum age is 3 years'),
                incompleteData:Z_STRING_TO_BOOLEAN
            })
            .partial(),
        learner: z
            .object({
                adm: z.union([Z_STRING, Z_NUMBER.pipe(z.coerce.string())]),
                name: Z_NAMES,
                dob: Z_DATE_TIME,
                grade: Z_GRADE,
                stream: Z_STRING,
                upi: Z_STRING.min(4),
                gender: Z_GENDER,
                county: Z_STRING,
                subCounty: Z_STRING,
                birthCertificateNo: Z_NUMBER_STRING,
                medicalCondition: Z_MEDICAL_CONDITION,
                isSpecial: z.boolean().default(false),
                marks: Z_NUMBER.min(0).max(500),
                indexNo: Z_INDEX_NUMBER,
                nationality: Z_NATIONALITIES,
                continuing: z.boolean(),
                kcpeYear: Z_NUMBER_STRING
            })
            .merge(Z_PARENT_CONTACTS)
            .merge(Z_TRANSFER)
            // Make everything optional
            .partial()
            // Only require the necessary fields
            .required(this.required)
            // Transform to align with database schema
            .transform((learner, ctx) => {
                let countyNumber = countyToNo(learner.county, learner.subCounty);
                if (countyNumber instanceof Error && this.requiredExtras.includes('county')) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${learner?.county} is not a valid county.`
                    });
                    z.never();
                }
                const [countyNo, subCountyNo] = Array.isArray(countyNumber) ? countyNumber : [];

                const completeContact =
                    (!!learner?.fatherName && !!learner?.fatherTel && !!learner?.fatherId) ||
                    (!!learner?.motherName && !!learner?.motherTel && !!learner?.motherId) ||
                    (!!learner?.guardianName && !!learner?.guardianTel && !!learner?.guardianId);

                if (!completeContact && this.requiredExtras.includes('contacts')) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `At least one parent should have all contact details ie: name, phone number and id number.`
                    });
                    z.never();
                }
                const transferInfo =
                    learner.transferredOn && learner.transferredFrom && learner.transferMethod
                        ? {
                              transferredOn: learner.transferredOn,
                              institution: { name: learner.transferredFrom },
                              method: learner.transferMethod,
                              reason: learner.transferReason
                          }
                        : null;

                if (!transferInfo && this.requiredExtras.includes('transfer')) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Transfer information not supplied.`
                    });
                    z.never();
                }

                const parentsContacts = {
                    father: {
                        name: learner?.fatherName,
                        tel: learner?.fatherTel,
                        id: learner?.fatherId
                    },
                    mother: {
                        name: learner?.motherName,
                        tel: learner?.motherTel,
                        id: learner?.motherId
                    },
                    guardian: {
                        name: learner?.guardianName,
                        tel: learner?.guardianTel,
                        id: learner?.guardianId
                    },
                    address: learner.address
                };

                return {
                    institutionId: this.req.institution._id,
                    adm: learner.adm,
                    name: learner.name,
                    gender: learner.gender,
                    dob: learner.dob,

                    // Learner educational details
                    birthCertificateNo: learner.birthCertificateNo,
                    upi: learner.upi,
                    grade: learner.grade,
                    stream: learner.stream,
                    kcpeYear: learner.kcpeYear,
                    indexNo: learner.indexNo,
                    marks: learner.marks,

                    transfer: transferInfo,
                    isContinuing: learner?.continuing,
                    contactDetails: parentsContacts,
                    geoLocationDetails: {
                        county: learner.county,
                        subCounty: learner.subCounty,
                        countyNo: countyNo,
                        subCountyNo: subCountyNo,
                        nationality: learner.nationality
                    },

                    isSpecial: learner.isSpecial,
                    medicalCondition: learner.medicalCondition
                };
            })
    };

    constructor(req: Request) {
        this.req = req;
        this.sendResponse = req.respond.sendResponse;
    }

    async addLearnerByFile() {
        try {
            // If for some reason the file path wasn't passed
            if (!Object.hasOwn(this.req.body, 'file')) {
                throw new CustomError(
                    'Invalid request. No file was uploaded. Please upload an Excel file using multi-part upload.',
                    400
                );
            }
            
            if (!Array.isArray(this.req.parsedExcel))
                throw new CustomError(
                    `File validation failed. Expected and array but instead received ${typeof this.req.parsedExcel}`
                );
            await this.learnerValidation(this.req.parsedExcel);
        } catch (err: any) {
            sendErrorMessage(this.req, err);
        }
    }

    addLearnerIgnoreList(
        requiredFields: DefaultLearnerValidationFields[],
        requiredExtra: ExtraValidationFields[]
    ) {
        let userIgnoreList = this.req.query?.ignore;
        if (!userIgnoreList) {
            this.required = Object.fromEntries(requiredFields.map(field => [field, true]));
            this.requiredExtras = requiredExtra;
            return;
        }

        if (typeof userIgnoreList === 'string') {
            let parsedIgnoreList = userIgnoreList.split(',');

            let erroredElements: string[] = [],
                ignoreExtras: ExtraValidationFields[] = [],
                ignoreList = LEARNER_FIELDS.filter(element => !this.defaultRequiredFields.includes(element));

            parsedIgnoreList.forEach((element: any) => {
                if (!ignoreList.includes(element)) {
                    if (requiredExtra?.includes(element)) {
                        ignoreExtras.push(element);
                    } else erroredElements.push(element);
                }
            });

            let erroredElementsLength = erroredElements.length;
            if (erroredElementsLength > 0) {
                throw new CustomError(
                    `${erroredElements.join(', ')} ${
                        erroredElementsLength > 1 ? 'are' : 'is'
                    } unsupported ignore field(s) or can not be ignored.`
                );
            }

            requiredFields = requiredFields.filter(element => !parsedIgnoreList.includes(element));

            Object.assign(this.required, Object.fromEntries(requiredFields.map(e => [e, true])));

            // Check if user wants to skip check for contacts and county fields
            this.requiredExtras = this.defaultExtraFields.filter(element => !ignoreExtras.includes(element));
        }
    }

    async learnerValidation(learners: unknown[]) {
        try {
            let learnersArray = !Array.isArray(learners) ? [learners] : learners;

            let validResults = [] as ValidLearner[],
                invalidResults = [] as {
                    validationError: string;
                }[];
            this.addLearnerIgnoreList(['grade', 'dob', 'gender', 'indexNo', 'marks'], ['county', 'contacts']);

            learnersArray.forEach((learner: any) => {
                learner.continuing = learner?.continuing ?? this.req.url.includes('continuing');
                let res = this.validations.learner.safeParse(learner);
                if (res.success) validResults.push(res.data);
                else {
                    let errorMessage = fromZodError(res.error);
                    invalidResults.push({
                        ...learner,
                        validationError: errorMessage.message
                    });
                }
            });

            if (invalidResults.length > 0) {
                return this.req.respond.sendError(
                    403,
                    `Validation failed. ${invalidResults.length} learner failed validation.`,
                    invalidResults
                );
            }
            await this.addLearnerToDatabase(validResults);
            this.req.respond.sendResponse(
                validResults,
                `${validResults.length} learner(s) added to database.`
            );
        } catch (err: any) {
            sendErrorMessage(this.req, err);
        }
    }

    async listLearner() {
        try {
            let query = this.validations.listLearnerQuery.parse(this.req.query);
            let queryObject = { institutionId: this.req.institution._id, 'archived.isArchived': false };

            for (const [key, value] of Object.entries(query) as [
                keyof typeof query,
                (typeof query)[keyof typeof query]
            ][]) {
                switch (key) {
                    case 'grade':
                    case 'gender':
                    case 'stream': {
                        if (Array.isArray(value)) Object.assign(queryObject, { [key]: { $in: value } });
                        break;
                    }
                    case 'withUpi':
                        if (typeof value === 'boolean')
                            Object.assign(queryObject, {
                                upi: value
                                    ? { $exists: true, $nin: [null, ''] }
                                    : { $exists: false, $in: [null, ''] }
                            });
                        break;
                    case 'withError':
                        if (typeof value === 'boolean')
                            Object.assign(queryObject, {
                                error: value
                                    ? { $exists: true, $nin: [null, ''] }
                                    : { $exists: false, $in: [null, ''] }
                            });
                        break;
                    case 'isArchived':
                        if (typeof value === 'boolean')
                            Object.assign(queryObject, {
                                'archived.isArchived': value
                            });
                        break;
                    case 'age':
                        if (typeof value === 'number')
                            Object.assign(queryObject, {
                                dob: {
                                    $lte: sub(new Date(), { years: value - 1, months: 6 }),
                                    $gte: sub(new Date(), { years: value, months: 6 })
                                }
                            });
                        break;
                    case 'transferred':
                        if (value)
                            Object.assign(queryObject, {
                                transfer: { $exists: true },
                                'transfer.method': { $in: value }
                            });
                        break;
                }
            }

            let data = query?.limit
                ? await learnerModel.find(queryObject).limit(query.limit)
                : await learnerModel.find(queryObject).limit(50);

            this.req.respond.sendResponse(data, `Query returned ${data.length} learners`);
        } catch (err) {
            sendErrorMessage(this.req, err);
        }
    }

    async searchLearner() {
        try {
            let id = z
                .string({
                    required_error:
                        'Unique identifier missing. In order to search a learner, an unique identifier must be provided which can either be: UPI, birth certificate number, or admission number.',
                    invalid_type_error: 'Unique identifier must be a string.'
                })
                .max(15, ' expected a string of less than 15 characters.')
                .parse(this.req.params?.id);

            let searchLearner = await learner.findOne({
                institutionId: { $eq: this.req.institution._id },
                $or: ['adm', 'birthCertificateNo', 'upi'].map(field => ({
                    [field]: { $eq: id }
                }))
            });

            if (!searchLearner) {
                throw new CustomError(
                    'No active learner found with the provided adm, birth certificate number or upi.' +
                        'Please check that the provided id is correct or enroll learners to the database.',
                    404
                );
            }
            this.req.respond.sendResponse(
                searchLearner,
                (searchLearner?.archived?.isArchived ? 'An archived learner ' : 'Learner ') +
                    'with the provided adm, birth certificate or upi was found.'
            );
        } catch (err) {
            sendErrorMessage(this.req, err);
        }
    }

    async syncLearnerDatabase() {
        try {
            this.req.respond.sendResponse(
                undefined,
                'Database sync has been initiated. This might take a while, depending on how responsive the NEMIS website is. '
            );
            await sync(this.req.institution);
        } catch (err) {
            sendErrorMessage(this.req, err);
        }
    }

    async deleteLearner() {
        try {
            let queryParams = z
                .object({
                    id: z.string({
                        required_error:
                            'Learner id is required. id can ne birth certificate number, upi, or admission number.'
                    }),
                    reason: z.string({ required_error: 'Archive reason was not provided.' })
                })
                .parse(this.req.query);

            let learner = await learnerModel.find({
                institutionId: this.req.institution._id,
                'archived.isArchived': { $ne: true },
                $or: ['adm', 'birthCertificateNo', 'upi'].map(field => ({
                    [field]: { $eq: queryParams.id }
                }))
            });
            if (learner.length === 0) {
                throw new CustomError(
                    'No learner in the database with the provided upi, adm or birth certificate number.',
                    404
                );
            }
            if (learner.length > 1) {
                throw new CustomError('More than one learner was returned with the provided id. ', 400);
            }
            let archivedLearner = await Object.assign(learner[0], {
                archived: {
                    isArchived: true,
                    reason: queryParams.reason,
                    archivedOn: dateTime()
                }
            }).save();

            this.req.respond.sendResponse(
                archivedLearner.toObject(),
                'This learners were successfully archived.'
            );
        } catch (err) {
            sendErrorMessage(this.req, err);
        }
    }

    private addLearnerToDatabase(validLearners: ValidLearner[]) {
        try {
            return Promise.all(
                validLearners.map(learner =>
                    learnerModel.updateOne({ adm: learner.adm }, learner, { upsert: true })
                )
            );
        } catch (err) {
            throw err;
        }
    }
}
