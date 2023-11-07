/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { Request } from "express";
import learner from "@database/learner";
import CustomError from "@libs/error_handler";
import { uniqueIdentifierSchema } from "@libs/zod_validation";
import NemisApiService from "@libs/nemis/api_handler";
import { NemisWebService } from "@libs/nemis";
import { Learner } from "../../../types/nemisApiTypes/learner";
import { Institution } from "../../../types/nemisApiTypes/institution";
import LearnerHandler from "@libs/nemis/learner_handler";

const admitJoiningLearner = async (req: Request) => {
    try {
        let learnersToAdmit = await learner
            .find({
                continuing: false, // Only admit joining learners
                institutionId: req.institution._id,
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
        await new NemisWebService().login(req.institution?.username, req.institution?.password);

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
            req.respond.sendResponse(learnersToAdmit, 'All learners are already admitted.');
            return;
        }

        // Send cookie to be used to initialize new nemis instance for each leanerWithoutUpi
        let admissionResults = await Promise.allSettled(
            learnersNotAdmitted.map(learner => admitLearner(new LearnerHandler(), learner, req.institution))
        );

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

        req.respond.sendResponse(learnersNotAdmitted);
        return;
    } catch (err) {
        sendErrorMessage(req, err);
    }
};
const admitSingleJoiningLearner = async (req: Request) => {
    try {
        let uniqueIdentifier = uniqueIdentifierSchema.parse(req.params?.uniqueIdentifier);

        let learnerToAdmit = await learner.findOne({
            $or: [{ birthCertificateNo: uniqueIdentifier }, { adm: uniqueIdentifier }],
            institutionId: req.institution._id,
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
            req.respond.sendResponse(learnerToAdmit, 'Learner has already been admitted.');
            return;
        }

        // Initialize NEMIS module and login
        await new NemisWebService().login(req.institution?.username, req.institution?.password);
        let learnerHandler = new LearnerHandler();

        try {
            await admitLearner(learnerHandler, learnerToAdmit, req.institution);
            learnerToAdmit.isAdmitted = true;
            learnerToAdmit.error = undefined;
        } catch (err: any) {
            learnerToAdmit.isAdmitted = false;
            learnerToAdmit.error = err.message ?? 'Unknown error';
        }

        await learner.updateOne({ _id: learnerToAdmit._id }, learnerToAdmit);

        req.respond.sendResponse(learnerToAdmit);
        return;
    } catch (err) {
        sendErrorMessage(req, err);
    }
};

const admitLearner = async (learnerHandler: LearnerHandler, learner: Learner, institution: Institution) => {
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
            nemisApi.reported(learner.indexNo, institution.username)
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
};

export { admitJoiningLearner, admitSingleJoiningLearner };
