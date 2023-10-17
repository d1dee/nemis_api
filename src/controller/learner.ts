/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */
// @ts-nocheck
import { ObjectId } from "mongoose";
import continuing_learner from "@database/continuing_learner";
import learnerModel from "@database/learner";
import nemisApiResultsModel from "@database/nemis_api_results";
import { NemisLearner, NemisLearnerFromDb } from "@interfaces";
import { AdmitOrCaptureRequestApiCalls } from "@libs/interface";
import { RequestingLearner } from "@middleware/interfaces";

interface NemisApiResults extends AdmitOrCaptureRequestApiCalls {
    admitted?: boolean;
    requested?: boolean;
}

interface Options {
    update?: boolean;
    create?: boolean;
}

export default class Learner {
    // call parseLearner before calling this method
    async addLearnerToDatabase(learnerJsonArray: NemisLearner[]) {
        try {
            if (!Array.isArray(learnerJsonArray))
                throw (
                    "Learner controller error. Learner json is not an array, expected an array" +
                    " with NemisLearner."
                );
            if (learnerJsonArray.length === 0)
                throw (
                    "Learner controller error. Learner json is an empty array, expected an" +
                    " array with NemisLearner."
                );
            // Parse and sanitize data before insert
            //	let cleanLearner = parseLearner(learnerJsonArray, institutionId, extraData);
            return learnerModel.insertMany(learnerJsonArray, { ordered: false });
        } catch (err) {
            throw err;
        }
    }

    async getLearnerFromDatabase(query: {}): Promise<NemisLearnerFromDb[]> {
        try {
            return await learnerModel.find(query).lean();
        } catch (err: any) {
            if (err.name === "CastError") {
                throw new Error("Cast error", { cause: err.message });
            }
            throw err;
        }
    }

    async addNemisApiResults(
        learner: { _id: ObjectId | string; nemisApiResultId?: string },
        apiResults: NemisApiResults,
        options: Options
    ) {
        try {
            if (options.create) {
                let apiResultsDocument = await nemisApiResultsModel.create({
                    ...apiResults,
                    learnerId: learner._id
                });
                let update = { nemisApiResultsId: apiResultsDocument._id.toString() };
                if (apiResults?.schoolAdmitted?.code) Object.assign(update, { admitted: true });
                if (apiResults?.schoolReported?.code) Object.assign(update, { reported: true });
                await this.updateLearnerInDatabase({ _id: learner._id }, update);
            }
            if (options.update) {
                if (!learner.nemisApiResultId)
                    throw new Error("Can not update without NemisApiResultId");
                await nemisApiResultsModel.findByIdAndUpdate(learner.nemisApiResultId, apiResults);
            }
        } catch (err) {
            throw err;
        }
    }

    // If update is not an array it will be updated in all filters
    async updateLearnerInDatabase(
        filter,
        update: Partial<NemisLearnerFromDb> | Partial<NemisApiResults>
    ) {
        try {
            if (!filter) return;
            if (!update) return;
            let filterArray, updateArray;
            if (Array.isArray(filter)) {
                if (filter.length === 0) return;
                // Check if every key is allowed as a filter
                if (
                    !filter.every(
                        x =>
                            Object.keys(x)
                                .map(k =>
                                    ["adm", "_id", "birthCertificateNo", "upi", "indexNo"].includes(
                                        k
                                    )
                                )
                                .filter(x => x).length > 0
                    )
                )
                    return;
                filterArray = filter;
            } else {
                if (typeof filter != "object") return;
                if (
                    Object.keys(filter)
                        .map(k =>
                            ["adm", "_id", "birthCertificateNo", "upi", "indexNo"].includes(k)
                        )
                        .filter(x => x).length > 0
                )
                    filterArray = [filter];
                else return;
            }

            if (Array.isArray(update)) {
                if (update.length != filterArray.length) {
                    throw new Error(
                        "Filter size is not equal to update size. Either update" +
                        " shouldn't be an array or update should be an object"
                    );
                }
                updateArray = update;
            } else {
                if (typeof update != "object") return;
                updateArray = [update];
            }
            let updatePromise = filterArray.map((x, i) => {
                if (Object.keys(x).includes("_id")) {
                    return learnerModel.findByIdAndUpdate(
                        x._id,
                        { ...updateArray[i] },
                        { omitUndefined: true }
                    );
                }
                return learnerModel.updateOne({ ...x }, { ...updateArray[i] }, { omitUndefined: true });
            });
            let successfulResults = [],
                failedResults = [];
            (await Promise.allSettled(updatePromise)).map(x => {
                if (x.status === "fulfilled") successfulResults.push(x.value);
                if (x.status === "rejected") failedResults.push(x.reason);
            });
            return {
                success: successfulResults,
                failed: failedResults
            };
        } catch (err) {
            throw err;
        }
    }

    // Save continuing learners
    async addContinuingLearner(continuingLearners: RequestingLearner[]) {
        try {
            if (!Array.isArray(continuingLearners) || continuingLearners.length < 1)
                throw new Error("continuingLearners should be an array of requesting learners.");
            // find learner_router in learner_router db and update to point to continuing learner_router

            let x = continuingLearners[0];
            let learnerInDb = await learnerModel.findOne({
                $or: [
                    { adm: x.adm },
                    { indexNo: x.indexNo },
                    { birthCertificateNo: x.birthCertificateNo }
                ]
            });
            if (!learnerInDb) {
                return Promise.reject("Learner was not added to database");
            }
            let cId = (
                await continuing_learner.create({
                    ...x,
                    grade: x.grade.toLowerCase(),
                    learnerId: learnerInDb._id.toString()
                })
            )._id;
            if (!cId) return Promise.reject("Failed to save continuing learner_router.");
            let c = await learnerModel.findByIdAndUpdate(learnerInDb._id, {
                continuingId: cId.toString()
            });
            console.log(c);
            // Add learners to db
            // Continue no matter the results
        } catch (err) {
            if (err?.code === 11000) return Promise.resolve();
            throw new Error(err);
        }
    }
}

/*
const addLearner = (learnerArray, instId: string | ObjectId, query?: { form: Number, stream: string }): Promise<{ success: boolean, successfulData: any[], failedData: any[] }> => {
    return new Promise((resolve) => {

        let successfulData: any[] = [];
        let failedData: any[] = [];
        let addPromises: Promise<any>[] = [];
        learnerArray.forEach(learner_router => {
                if (!learner_router.form && query?.form) {
                    learner_router.form = query.form;
                }
                if (!learner_router.stream && query?.stream) {
                    learner_router.stream = query.stream;
                }
                if (sanitize_data(learner_router).success) {
                    //prep for db
                    let learnerMap = new Map(Object.entries(learner_router));

                    ['father', 'mother', 'guardian'].forEach(key => {
                        learnerMap.set(key, {
                                name: learnerMap.get(`${key}Name`),
                                id: learnerMap.get(`${key}Id`),
                                tel: learnerMap.get(`${key}Tel`)
                            }
                        )
                    });

                    learnerMap.set('inst', instId);

                    ["fatherName", "fatherId", "fatherTel", "motherName", "motherId", "motherTel", "guardianName", "guardianId", "guardianTel"].forEach(key => {
                        learnerMap.delete(key)
                    });

                    learnerMap.forEach((value: Parent | string, key) => {
                        if (typeof value === 'string') {
                            if (value === '' || value === null || value === undefined) {
                                learnerMap.delete(key);
                            }
                        } else {
                            if (['father', 'mother', 'guardian'].includes(key)) {
                                if (value.name === '' || value.name === null || value.name === undefined) {
                                    learnerMap.delete(key);
                                }
                            }
                        }
                    });

                    // promise to add to db
                    addPromises.push(
                        new Promise((resolve, reject) => {
                            learnerModel.createIndexes({unique: true, background: false})
                                .then(() => {
                                    learner_router = Object.fromEntries(learnerMap)
                                    learnerModel.updateOne({adm: learner_router.adm}, learner_router, {upsert:
                                     true,
                                     rawResult: true})
                                        .then((doc) => {
                                            if (doc.upsertedId) {
                                                inst_schema.findByIdAndUpdate(instId, {$push: {learners: doc.upsertedId}})
                                                    .then(() => {
                                                        try {
                                                            delete learner_router.inst
                                                            delete learner_router.$setOnInsert
                                                            successfulData.push(learner_router)
                                                            resolve(true)
                                                        } catch (err) {
                                                            reject(err)
                                                        }

                                                    }).catch(err => {
                                                    logger.warn(err)
                                                    reject(err)
                                                });
                                            } else if (doc.acknowledged) {
                                                try {
                                                    delete learner_router.inst
                                                    delete learner_router.$setOnInsert
                                                    successfulData.push(learner_router)
                                                    resolve(true)
                                                } catch (err) {
                                                    reject(err)
                                                }
                                            }
                                        })
                                        .catch(err => {
                                            learnerMap.delete('inst')
                                            logger.error(err)

                                            failedData.push({
                                                success: false,
                                                message: err.message,
                                                learner_router: Object.fromEntries(learnerMap)
                                            })
                                            resolve(false)

                                        })

                                })
                                .catch(err => {
                                    logger.error(err)
                                    reject(err)
                                })
                        })
                    )
                } else {
                    failedData.push(sanitize_data(learner_router))
                }

            }
        )
        Promise.all(addPromises).then(() => {
            resolve({success: successfulData.length > 0, successfulData, failedData})
        })
    })
}

const updateLearner = (learnerArray, instId, query, filter?: {}): Promise<{ success: boolean, successfulData: any[], failedData: any[] }> => {
    return new Promise((resolve) => {

        let successfulData: any[] = [];
        let failedData: any[] = [];
        let addPromises: Promise<any>[] = [];
        learnerArray.forEach(learner_router => {
                let sanitizedFilter = {}
                if (typeof filter !== 'object') {
                    //find data from learnerMap
                    let filterMap = new Map(Object.entries(filter || {}));
                    ['adm', 'upi', 'indexNo'].forEach(key => {
                        if (learner_router[key]) {
                            if (learner_router[key] !== '' || learner_router[key] !== null || learner_router[key] !== undefined) {
                                filterMap.set(key, learner_router[key])
                            }
                        }
                    })
                    if (filterMap.size === 0) {
                        failedData.push({
                            success: false,
                            message: `No filter provided`,
                            learner_router: learner_router
                        })
                        return
                    }
                    sanitizedFilter = Object.fromEntries(filterMap)
                } else {
                    //find data from filter
                    Object.keys(filter).forEach((key) => {
                        if (!['adm', 'upi', 'indexNo'].includes(key)) {
                            delete filter[key]
                        }
                    })
                    sanitizedFilter = filter
                }

                if (!learner_router.form && query?.form) {
                    learner_router.form = query.form;
                }
                if (!learner_router.stream && query?.stream) {
                    learner_router.stream = query.stream;
                }
                let sanitizedData = sanitize_data(learner_router);
                if (sanitizedData.success) {
                    //prep for db
                    let learnerMap = new Map(Object.entries(learner_router));

                    ['father', 'mother', 'guardian'].forEach(key => {
                        learnerMap.set(key, {
                                name: learnerMap.get(`${key}Name`),
                                id: learnerMap.get(`${key}Id`),
                                tel: learnerMap.get(`${key}Tel`)
                            }
                        )
                    });

                    ["fatherName", "fatherId", "fatherTel", "motherName", "motherId", "motherTel", "guardianName", "guardianId", "guardianTel"].forEach(key => {
                        learnerMap.delete(key)
                    });

                    learnerMap.forEach((value: Parent | string, key) => {
                        if (typeof value === 'string') {
                            if (value === '') {
                                learnerMap.delete(key);
                            }
                        } else {
                            if (['father', 'mother', 'guardian'].includes(key)) {
                                if (value?.name === '' || value?.name === null || value?.name === undefined) {
                                    learnerMap.delete(key);
                                }
                            }
                        }
                    });

                    logger.trace(Object.fromEntries(learnerMap))
                    // promise to add to db
                    addPromises.push(
                        new Promise((resolve) => {

                            learnerModel.findOneAndUpdate({
                                ...sanitizedFilter,
                                inst: instId
                            }, Object.fromEntries(learnerMap), {omitUndefined: true, upsert: true, lean: true, new: true})
                                .then((doc) => {
                                    logger.trace(`Updated learner_router ${doc.name} with indexNo
                                     ${doc.indexNo} and id ${doc._id}`)

                                    delete doc._id
                                    delete doc.__v
                                    delete doc.inst

                                    successfulData.push(doc)
                                    resolve(true)

                                })
                                .catch(err => {
                                    learnerMap.delete('inst')
                                    logger.error(err)

                                    failedData.push({
                                        success: false,
                                        message: err.message,
                                        learner_router: Object.fromEntries(learnerMap)
                                    })
                                    resolve(false)
                                })
                        })
                    )
                } else {
                    failedData.push(sanitize_data(learner_router))
                }
            }
        )
        Promise.all(addPromises).then(() => {
            resolve({success: successfulData.length > 0, successfulData, failedData})
        })
    })
}
*/
