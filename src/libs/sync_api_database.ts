/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */
// @ts-nocheck
import { GRADES } from "./constants";
import learnerModule from "@database/learner";
import { InstitutionDocument } from "../../types/nemisApiTypes/institution";
import LearnerHandler from "@libs/nemis/learner_handler";
import { ListLearners } from "../../types/nemisApiTypes/learner";

const sync = async (institution: InstitutionDocument) => {
    try {
        const supportedGrades = institution?.nemisInstitutionData?.supportedGrades;
        if (!supportedGrades) throw new Error('Institution has no supported grades in the database.');

        // List all learners
        let allLearnerPromise = supportedGrades.map(grade => {
            // Use a new instance of NemisWebService to avoid state conflict
            let learnerHandler = new LearnerHandler();
            return learnerHandler
                .login(institution.username, institution.password)
                .then(_ => learnerHandler.listLearners(grade));
        });

        let listAllLearners = await Promise.allSettled(allLearnerPromise);
        // Map list learner to an easy-to-use object
        let mappedListLearner = {} as { [K in (typeof GRADES)[number]]: ListLearners };

        supportedGrades.forEach((grade, i) => {
            Object.assign(mappedListLearner, {
                [grade]:
                    listAllLearners[i].status === 'fulfilled'
                        ? listAllLearners[i].value.sort((a, b) =>
                              a.birthCertificateNo?.localeCompare(b.birthCertificateNo)
                          )
                        : []
            });
        });

        for (const grade of supportedGrades) {
            if (mappedListLearner[grade].length === 0) continue;

            let updatePromise = mappedListLearner[grade].map(learner =>
                learnerModule.findOneAndUpdate(
                    {
                        institutionId: institution._id,
                        grade: grade,
                        gender: learner.gender,
                        birthCertificateNo: learner.birthCertificateNo
                    },
                    { upi: learner.upi, nhifNo: learner.nhifNo, hasReported: true, isAdmitted: true }
                )
            );

            await Promise.all(updatePromise);
        }

        console.debug('local database has been synced');
    } catch (err) {
        console.warn(err);
    }
};

export { sync };
