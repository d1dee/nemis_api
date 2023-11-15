/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { NemisWebService } from "@libs/nemis";
import { GRADES } from "./constants";
import learner from "@database/learner";
import { InstitutionDocument } from "../../types/nemisApiTypes/institution";
import LearnerHandler from "@libs/nemis/learner_handler";
import { ListLearners } from "../../types/nemisApiTypes/learner";

const sync = async (institution: InstitutionDocument) => {
    try {
        const supportedGrades = institution?.nemisInstitutionData?.supportedGrades;
        if (!supportedGrades) throw new Error('Institution has no supported grades in the database.');
        // List all learners
        let listAllLearners = await Promise.all(
            // Use a new instance of NemisWebService to avoid state conflict
            supportedGrades.map(grade =>
                new NemisWebService()
                    .login(institution.username, institution.password)
                    .then(() => new LearnerHandler().listLearners(grade))
            )
        );

        // Map list learner to an easy-to-use object
        let mappedListLearner = {} as { [K in (typeof GRADES)[number]]: ListLearners };

        supportedGrades.forEach((grade, i) => {
            Object.assign(mappedListLearner, {
                [grade]: listAllLearners[i]
                    ? listAllLearners[i]!.sort((a, b) =>
                          a.birthCertificateNo?.localeCompare(b.birthCertificateNo)
                      )
                    : []
            });
        });

        // Get learner from database
        let databaseLearner = await Promise.all(
            supportedGrades.map(
                grade =>
                    learner
                        .find({
                            grade: grade,
                            institutionId: institution._id,
                            captured: {
                                $in: [null, undefined, '', false]
                            },
                            upi: {
                                $in: [null, undefined, '', 0]
                            }
                        })
                        .sort({ birthCertificateNo: 1 }) // Sort birth certificate number  by ascending order
            )
        );

        // Map database learner to an easy-to-use object
        let mappedDatabaseLearner = {} as {
            [K in (typeof GRADES)[number]]: (typeof databaseLearner)[number];
        };
        supportedGrades.forEach((grade, i) => {
            Object.assign(mappedDatabaseLearner, {
                [grade]: databaseLearner[i]
            });
        });

        // Since we now have identical well mapped database result and list learner results,
        // we can go ahead and start to build a combined list with updates on database learners
        let updatedLearner = [] as (typeof databaseLearner)[number];

        for (const grade of supportedGrades) {
            // @ts-ignore
            let databaseLearner = mappedDatabaseLearner[grade];
            // @ts-ignore
            let listLearner = mappedListLearner[grade];
            if (!Array.isArray(listLearner) || listLearner.length === 0) {
                continue;
            }
            // @ts-ignore
            databaseLearner.forEach(learner => {
                // If learner has a birth certificate number
                if (learner.birthCertificateNo) {
                    // todo: set up binary search to reduce time
                    let filteredLearnerLocation = [] as number[];
                    let i = 0;
                    // @ts-ignore
                    let filteredLearner = listLearner.filter(x => {
                        if (x.birthCertificateNo === learner.birthCertificateNo) {
                            filteredLearnerLocation.push(i);
                            return true;
                        }
                        i++;
                        return false;
                    });
                    if (filteredLearner.length === 1) {
                        Object.assign(learner, {
                            upi: filteredLearner[0].upi,
                            reported: true,
                            admitted: true,
                            nhifNo: filteredLearner[0].nhifNo,
                            error: undefined
                        });
                        updatedLearner.push(learner);
                        listLearner.splice(filteredLearnerLocation[0], 1);
                    }
                }
            });
        }

        await Promise.all(updatedLearner.map(x => x.save()));

        console.debug('local database has been synced');
    } catch (err) {
        console.warn(err);
    }
};

export { sync };
