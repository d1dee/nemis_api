/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { Request } from "express";
import learnerModel from "@database/learner";
import { z } from "zod";
import CustomError from "@libs/error_handler";

const deleteSingleLearner = async (req: Request) => {
    try {
        let queryParams = z
            .object({
                id: z.string({
                    required_error:
                        'Learner id is required. id can ne birth certificate number, upi, or admission number.'
                }),
                reason: z.string({ required_error: 'Archive reason was not provided.' })
            })
            .parse(req.query);
        await learnerModel.updateMany({}, { archived: null });

        let learner = await learnerModel.find({
            institutionId: req.institution._id,
            // archived: { isArchived: { $ne: true } },
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
        let archivedLearner = Object.assign(learner[0], {
            archived: {
                isArchived: true,
                reason: queryParams.reason,
                archivedOn: Date.now().toString()
            }
        }).save();

        /*await learner[0].updateOne(
            { archived: { archivedOn: Date.now(), isArchived: true, reason: queryParams.reason } },
            { returnDocument: 'after' }
        );*/

        if (!archivedLearner) {
            throw new CustomError('An error was encountered while archiving learner.', 500);
        }
        req.sendResponse.respond('This learners were successfully archived.');
    } catch (err) {
        sendErrorMessage(req, err);
    }
};
export { deleteSingleLearner };
