/*
/!*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 *!/
// @ ts-nocheck

import { Request } from 'express';
import learner from '../../database/learner';
import { CaptureBiodataResponse, Grades, ListLearner } from '../../../types/nemisApiTypes';
import CustomError from '../../libs/error_handler';
import { sendErrorMessage } from '../utils/middlewareErrorHandler';

const captureContinuingLearner = async (req: Request) => {
	try {
		// call Sync db to update our local database
		// Get continuing learners to capture
		let continuingLearners = await learner
			.find({
				$and: [
					{ continuing: true },
					{ birthCertificateNo: { $type: 'string' } },
					{ upi: { $in: [0, null, ''] } },
					{ archived: false }
				]
			})
			.lean();
		if (!continuingLearners || !Array.isArray(continuingLearners)) {
			throw new CustomError('No continuing learners in the database', 403);
		}
		// Get all grades to query list learner
		let listGrades = [...new Set(continuingLearners.map(x => x.grade))];
		let listLearner: { [K in Grades]?: ListLearner[] } = {};
		// we can't use Promise.all because NEMIS does keep a state. Return a list learner array sorted by birth certificate numbers
		for await (const grade of listGrades) {
			Object.assign(listLearner, {
				[grade]: (await req.nemis.listLearners(grade as Grades)).sort((a, b) =>
					a.birthCertificateNo.localeCompare(b.birthCertificateNo)
				)
			});
		}
		// Check if any of the continuing learners has a UPI number
		//console.time("matching_learner_to_upi");

		for (let i = 0; i < continuingLearners.length; i++) {
			let gradeListLearner = listLearner[continuingLearners[i].grade];
			if (!gradeListLearner || !Array.isArray(gradeListLearner)) {
				continue;
			}
			let foundLearnerUpi = gradeListLearner.find(
				x => continuingLearners[i].birthCertificateNo === x.birthCertificateNo
			);
			if (foundLearnerUpi) {
				Object.assign(continuingLearners[i], {
					...continuingLearners[i],
					upi: foundLearnerUpi.upi,
					error: null
				});
			}
		}

		let captureBiodataPromises = await Promise.allSettled(
			continuingLearners.map(x =>
				!x?.upi
					? req.nemis.addContinuingLearner(x)
					: <CaptureBiodataResponse>{
							upi: x?.upi,
							message: 'already captured',
							alertMessage: undefined
					  }
			)
		);
		// Return an update for each continuingLearner
		let captureBiodataUpdate = (index: number) => {
			let x = captureBiodataPromises[index];
			return x.status === 'fulfilled'
				? { upi: x.value?.upi, error: null }
				: { error: <string>x.reason?.message || 'Error while capturing learner biodata' };
		};
		// Save results to database
		let databaseUpdate = await Promise.all(
			continuingLearners.map((x, i) =>
				learner.findByIdAndUpdate(
					x._id,
					{ $set: captureBiodataUpdate(i) },
					{ returnDocument: 'after' }
				)
			)
		);

		// Get continuing learners without birth certificate numbers
		let withErrors = await learner.aggregate([
			{
				$match: {
					$and: [
						{ continuing: true },
						{
							$or: [
								{
									birthCertificateNo: {
										$in: [null, '', 0]
									}
								},
								{
									error: {
										$type: 'string',
										$nin: [null, '', 0]
									}
								}
							]
						}
					]
				}
			},
			{
				$set: {
					error: {
						$cond: {
							if: {
								$eq: [
									{
										$type: '$birthCertificateNo'
									},
									'string'
								]
							},
							then: '$error',
							else: 'No birth certificate supplied'
						}
					}
				}
			}
		]);
		req.sendResponse.respond(
			withErrors.length > 0 ? withErrors : databaseUpdate,
			`Operation completed successfully ${withErrors.length > 0 ? 'with below errors' : ''}`
		);
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};
export { captureContinuingLearner };
*/
