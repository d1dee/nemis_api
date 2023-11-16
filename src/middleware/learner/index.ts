/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */
import { z } from "zod";
import {
    Z_DATE_TIME,
    Z_GENDER,
    Z_GRADE,
    Z_ID,
    Z_INDEX_NUMBER,
    Z_MEDICAL_CONDITION,
    Z_NAMES,
    Z_NATIONALITIES,
    Z_NUMBER,
    Z_NUMBER_STRING,
    Z_PHONE_NUMBER,
    Z_STRING,
    Z_TRANSFER_METHOD
} from "@libs/constants";
import { countyToNo, dateTime } from "@libs/converts";
import CustomError from "@libs/error_handler";
import { validateExcel } from "@libs/import_excel";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { Request } from "express";
import learnerModel from "@database/learner";
import learner from "@database/learner";
import { sub } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { sync } from "@libs/sync_api_database";
import { fromZodError } from "zod-validation-error";

export default class Learner {
    private readonly req;
    private readonly sendResponse;
    private partial: any = {
        transferredOn: true,
        subCounty: true,
        transferredFrom: true,
        transferMethod: true,
        transferReason: true,
        medicalCondition: true,
        isSpecial: true,
        nationality: true,
        upi: true,
        continuing: true,
        address: true,
        marks: true,
        kcpeYear: true,
        // All parents are optional so that we can later check for complete parent data during transform()
        fatherName: true,
        fatherTel: true,
        fatherId: true,
        motherName: true,
        motherTel: true,
        motherId: true,
        guardianName: true,
        guardianTel: true,
        guardianId: true
    };
    validations = {
        learner: z
            .object({
                adm: z.union([Z_STRING, Z_NUMBER]),
                name: Z_NAMES,
                dob: Z_DATE_TIME,
                grade: Z_GRADE,
                stream: Z_STRING,
                upi: Z_STRING.min(4),
                gender: Z_GENDER,
                fatherName: Z_NAMES,
                fatherTel: Z_PHONE_NUMBER,
                fatherId: Z_ID,
                motherName: Z_NAMES,
                motherTel: Z_PHONE_NUMBER,
                motherId: Z_ID,
                guardianName: Z_NAMES,
                guardianTel: Z_PHONE_NUMBER,
                guardianId: Z_ID,

                address: Z_NUMBER_STRING,
                county: Z_STRING,
                subCounty: Z_STRING,
                birthCertificateNo: Z_NUMBER_STRING,
                medicalCondition: Z_MEDICAL_CONDITION,
                isSpecial: z.boolean().default(false),
                marks: Z_NUMBER.min(0).max(500),
                indexNo: Z_INDEX_NUMBER,

                transferredOn: z.coerce.date(),
                transferReason: Z_STRING,
                transferMethod: Z_TRANSFER_METHOD,
                transferredFrom: Z_STRING,

                nationality: Z_NATIONALITIES,
                continuing: z.boolean().default(false),
                kcpeYear: Z_NUMBER.default(new Date().getFullYear()).pipe(Z_STRING.min(4))
            })
            .partial(this.partial)
            .transform((learner, ctx) => {
                let countyNumber = countyToNo(learner.county, learner.subCounty);
                if (countyNumber instanceof Error && !this.partial?.county) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${learner?.county} is not a valid county.`
                    });
                    return z.never;
                }
                const completeContact =
                    (!!learner?.fatherName && !!learner?.fatherTel && !!learner?.fatherId) ||
                    (!!learner?.motherName && !!learner?.motherTel && !!learner?.motherId) ||
                    (!!learner?.guardianName && !!learner?.guardianTel && !!learner?.guardianId);

                if (!completeContact) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `At least one parent should have all contact details ie: name, phone number and id number.`
                    });
                    return z.never;
                }

                const [countyNo, subCountyNo] = Array.isArray(countyNumber) ? countyNumber : [];

                let contactDetails = {
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

                let transfer =
                    learner.transferredOn && learner.transferredFrom && learner.transferMethod
                        ? {
                              transferredOn: learner.transferredOn,
                              institution: { name: learner.transferredFrom },
                              method: learner.transferMethod,
                              reason: learner.transferReason
                          }
                        : null;

                return {
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

                    transfer: transfer,
                    isContinuing: learner?.continuing,
                    contactDetails: contactDetails,

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
        this.sendResponse = this.req.respond.sendResponse;
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

            let excelJson = validateExcel(this.req.body.file);
            if (!Array.isArray(excelJson))
                throw new CustomError(
                    `File validation failed. Expected and array but instead received ${typeof excelJson}`
                );
            // Validate requested fil
            let validResults = [];
            let invalidResults = [];

            excelJson.forEach(learner => {
                let res = this.validations.learner.safeParse(excelJson);
                if (res.success) validResults.push(res.data);
                else
                    invalidResults.push({
                        invalidObject: learner,
                        errorMessage: fromZodError(res.error)
                    });
            });

            if (invalidResults.length > 0) {
                this.req.respond.sendError(403, 'validation failed', validationResults);
            }

            // await this.handleValidatedData(learnerJson);
        } catch (err: any) {
            sendErrorMessage(this.req, err);
        }
    }

    async addLearnerByJson() {
        try {
            // Validate requested learner
            let validatedLearner = Array.isArray(this.req.body)
                ? z.array(this.validations.learner).safeParse(learner)
                : this.validations.learner.safeParse(this.req.body);

            await this.handleValidatedData([]);
        } catch (err: any) {
            sendErrorMessage(this.req, err);
        }
    }

    async handleValidatedData(validatedJson: any[]) {
        let validationError = validatedJson.filter(x => !!x.validationError);
        if (validationError.length > 0) {
            throw new CustomError(
                'Validation error.' +
                    'One or more fields failed to validate. Please check the following errors',
                400,
                validationError
            );
        }

        let insertedDocs = await Promise.all(
            validatedJson.map(learner =>
                learnerModel.findOneAndUpdate(
                    { adm: { $eq: learner.adm } },
                    {
                        ...learner,
                        institutionId: this.req.institution._id,
                        continuing: learner.continuing
                            ? learner.continuing
                            : this.req.url.includes('continuing'),
                        archived: false
                    },
                    {
                        upsert: true,
                        returnDocument: 'after'
                    }
                )
            )
        );
        this.sendResponse(insertedDocs, `${insertedDocs.length} learners added to the database.`);
    }

    async listLearner() {
        try {
            // Validatethis.req.query
            let query = z
                .object({
                    limit: z.coerce
                        .number({ invalid_type_error: 'Limit must be a number.' })
                        .multipleOf(10, 'Limit must be multiple of 10'),
                    grade: Z_GRADE,
                    gender: Z_GENDER,
                    transferred: z.enum(['in', 'out']),
                    stream: z.coerce.string(),
                    withUpi: z.coerce
                        .string()
                        .toLowerCase()
                        .transform(arg => arg === 'true'),
                    withError: z.coerce
                        .string()
                        .toLowerCase()
                        .transform(arg => arg === 'true'),
                    name: z.coerce.string().min(3, 'Name string must be at least 3 letters long.'),
                    age: z.coerce.number().min(3, 'Minimum age is 3 years')
                })
                .partial()
                .transform(value => {
                    Object.assign(value, { upi: value.withUpi, error: value.withError });
                    return value;
                })

                .parse(this.req.query);
            // Construct a database query from req.query
            let queryObject = { institutionId: this.req.institution._id, archived: false };

            Object.entries(query).forEach(keyValue => {
                switch (keyValue[0]) {
                    case 'grade':
                    case 'gender':
                    case 'stream':
                        Object.assign(queryObject, { [keyValue[0]]: { $eq: keyValue[1] } });
                        break;

                    case 'error':
                    case 'upi':
                        if (keyValue[1] !== undefined)
                            Object.assign(queryObject, {
                                [keyValue[0]]: keyValue[1]
                                    ? {
                                          $exists: true,
                                          $nin: [null, undefined, '']
                                      }
                                    : { $exists: false, $in: [null, undefined, ''] }
                            });
                        break;
                    case 'age':
                        if (query.age)
                            Object.assign(queryObject, {
                                dob: {
                                    $lte: sub(new Date(), { years: query.age - 1, months: 6 }),
                                    $gte: sub(new Date(), { years: query.age, months: 6 })
                                }
                            });
                        break;
                    case 'transferred':
                        if (query.transferred === 'in') {
                            Object.assign(queryObject, { transferred: { $exists: true } });
                        }
                }
            });

            let data = query?.limit
                ? await learnerModel.find(queryObject).limit(query.limit)
                : await learnerModel.find(queryObject);

            this.sendResponse(data);
        } catch (err) {
            sendErrorMessage(this.req, err);
        }
    }

    async searchLearner() {
        try {
            let id = z
                .string({
                    required_error:
                        'Unique identifier missing.To delete a learner, a unique identifier must be provided. The identifier can be either the UPI, birth certificate number, or admission number.',
                    invalid_type_error: ' Unique identifier must be a string.'
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
            this.sendResponse(
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
            this.sendResponse(
                undefined,
                'Database sync has been initiated. This might take a while, depending on how responsive the Nemis website is. '
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
            await learnerModel.updateMany({}, { archived: null });

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
                throw new CustomError('More than one learner was returned with the provided id.', 400);
            }
            let f = formatInTimeZone(new Date(), 'Africa/Nairobi', 'yyyy-MM-dd HH:mm:ss zzz');
            let archivedLearner = await Object.assign(learner[0], {
                archived: {
                    isArchived: true,
                    reason: queryParams.reason,
                    archivedOn: dateTime()
                }
            }).save();

            /*await learner[0].updateOne(
                { archived: { archivedOn: Date.now(), isArchived: true, reason: queryParams.reason } },
                { returnDocument: 'after' }
            );*/

            this.sendResponse(archivedLearner.toObject(), 'This learners were successfully archived.');
        } catch (err) {
            sendErrorMessage(this.req, err);
        }
    }
}
