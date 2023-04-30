/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

// @ts-nocheck
import { AxiosError } from 'axios';
import { Promise } from 'mongoose';
import { NemisLearnerFromDb } from '../../../interfaces';
import { Request } from 'express';
import learner from '../../database/learner';
import { ListAdmittedLearner, ListLearner } from '../../../types/nemisApiTypes';

const captureJoiningLearner = async (req: Request) => {
	try {
		let listLearner: ListLearner[] = await req.nemis.listLearners('form 1');
		let awaitingBiodataCapture: ListAdmittedLearner[] =
			await req.nemis.getAdmittedJoiningLearners();
		if (awaitingBiodataCapture.length === 0)
			req.sendResponse.respond([], 'There is no learner left to capture biodata.');
		let updateUpi = <(NemisLearnerFromDb & ListLearner)[]>[];
		// Learner admitted and has birth certificate
		let admittedHasBirthCertificate = await learner
			.find({
				$and: [
					{ indexNo: { $in: awaitingBiodataCapture.map(x => x.indexNo) } },
					{ birthCertificateNo: { $exists: true, $ne: null, $type: 'string' } },
					{ institutionId: req.institution?._id }
				]
			})
			.lean();
		/**
		 * To optimize search functionality, it would be beneficial to sort both
		 * listLearners and awaitingBiodataCapture arrays using the same criteria
		 * as admittedHasBirthCertificate, which is birth certificate number and index number respectively.
		 * This would streamline the search process and enhance overall performance
		 * for more efficient and accurate results.
		 */
		listLearner.sort((a, b) => (a.birthCertificateNo > b.birthCertificateNo ? 1 : -1));
		awaitingBiodataCapture.sort((a, b) => (a.indexNo > b.index ? 1 : -1));

		let learnerToCapture = [];
		// Match each Learner to their specific UPI only remaining with those without UPI linked
		for (let i = 0; i < admittedHasBirthCertificate.length; i++) {
			if (admittedHasBirthCertificate[i]?.upi) continue;
			let filter = listLearner.filter(
				x => x.birthCertificateNo === admittedHasBirthCertificate[i]?.birthCertificateNo
			);
			if (filter.length > 0) {
				updateUpi.push({
					...admittedHasBirthCertificate[i],
					...filter[0]
				});
				continue;
			}
			filter = awaitingBiodataCapture.filter(
				x => x.indexNo === admittedHasBirthCertificate[i].indexNo
			);
			if (filter.length > 0) {
				learnerToCapture.push({ ...admittedHasBirthCertificate[i], ...filter[0] });
			}
		}

		if (learnerToCapture.length === 0) {
			req.sendResponse.respond([], 'No learner_router to capture biodata.');
		}
		/* if (Object.keys(req.queryParams).includes("await") && req.queryParams?.await === false) {
			 req.sendResponse.respond(
				 learnerToCapture,
				 "Below learners' biodata will be captured in" + " the background"
			 );
		 }*/
		await Promise.allSettled(
			updateUpi.map(x =>
				learner.findByIdAndUpdate(
					x._id,
					{
						upi: x?.upi,
						reported: true,
						error: null
					},
					{ new: true }
				)
			)
		);

		let capturedResults = (
			await Promise.allSettled(
				(
					await Promise.allSettled(
						learnerToCapture.map(x => req.nemis.captureJoiningBiodata(x))
					)
				).map(
					(
						x: { status: string; value: { upi: any }; reason: { message: any } },
						i: number
					) => {
						if (x.status === 'fulfilled') {
							return learner.findOneAndUpdate(
								{ indexNo: learnerToCapture[i].indexNo },
								{ upi: x.value?.upi, reported: true, admitted: true, error: null },
								{ new: true }
							);
						}
						return learner.findOneAndUpdate(
							{ indexNo: learnerToCapture[i].indexNo },
							{ error: x.reason?.message },
							{ new: true }
						);
					}
				)
			)
		).map((x: { status: string; value: any; reason: any }) =>
			x.status === 'fulfilled' ? x?.value : x?.reason
		);

		req.sendResponse.respond(
			capturedResults,
			'Processing biodata capture finished with the below' + ' results'
		);
	} catch (err: any) {
		req.sendResponse.error(
			err.code || 500,
			err.message || 'Internal server error',
			err.cause || err instanceof AxiosError ? 'axios error' : err
		);
	}
};
/*const getCapturedBiodata = async (req: Request) => {
    try {
        let listLearner = await req.nemis.listLearners('form 1');
        if (Object.keys(req.queryParams).includes('admitted') && !req.queryParams.admitted) {
            let awaitingBiodataCapture = await req.nemis.getAdmittedJoiningLearners();
            if (awaitingBiodataCapture.length === 0)
                return req.sendResponse.respond(
                    awaitingBiodataCapture,
                    'Admitted' + ' learner_router list retrieved successfully'
                );
            let notCaptured = awaitingBiodataCapture.filter(
                x => listLearner?.filter(y => y.upi === x.upi).length === 0
            );
            if (notCaptured.length > 0) {
                let notCapturedFromDb = await learner_router
                    .find({
                        $or: notCaptured.map(x => {
                            return { indexNo: x.indexNo };
                        })
                    })
                    .lean();
                if (Array.isArray(notCapturedFromDb) && notCapturedFromDb.length > 0) {
                    notCaptured = notCaptured.map(x => {
                        let z = notCapturedFromDb.filter(y => x.indexNo === y.indexNo)[0];
                        return z ? { ...x, ...z } : x;
                    });
                }
            }
            return req.sendResponse.respond(
                notCaptured,
                'Below are the learners awaiting Biodata' + 'Capture on the Nemis website.'
            );
        }
        return req.sendResponse.respond(listLearner, 'Admitted learner_router list retrieved successfully');
    } catch (err:any) {
        req.sendResponse.error(
            err.code || 500,
            err.message || 'Internal server error',
            err.cause || err
        );
    }
};*/
export { captureJoiningLearner };
