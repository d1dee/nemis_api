import { DbInstitution, ListLearner } from '../../types/nemisApiTypes';
import { NemisWebService } from './nemis/nemis_web_handler';
import { GRADES } from './zod_validation';
import learner from '../database/learner';
import logger from './logger';

const sync = async (institution: DbInstitution) => {
	try {
		// todo: move this run this in a separate thread?
		console.time('sync');
		// List all learners
		let listAllLearners = await Promise.all(
			// Use a new instance of NemisWebService to avoid state conflict
			institution.supportedGrades.map((grade): Promise<ListLearner[]> => {
				// Nemis state is tied to the cookie returned, so we log in for each grade  to have separate states for each
				return new Promise(async (resolve, reject) => {
					try {
						let nemis = new NemisWebService();
						await nemis.login(institution.username, institution.password);
						resolve(await nemis.listLearners(grade));
					} catch (err) {
						reject(err);
					}
				});
			})
		);

		// Map list learner to an easy-to-use object
		let mappedListLearner = {} as { [K in (typeof GRADES)[number]]: ListLearner[] };
		institution.supportedGrades.forEach((grade, i) => {
			Object.assign(mappedListLearner, {
				[grade]: listAllLearners[i].sort((a, b) =>
					a.birthCertificateNo?.localeCompare(b.birthCertificateNo)
				)
			});
		});

		// Get learner from database
		let databaseLearner = await Promise.all(
			institution.supportedGrades.map(
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
		institution.supportedGrades.forEach((grade, i) => {
			Object.assign(mappedDatabaseLearner, {
				[grade]: databaseLearner[i]
			});
		});

		// Since we now have identical well mapped database result and list learner results,
		// we can go ahead and start to build a combined list with updates on database learners
		let updatedLearner = [] as (typeof databaseLearner)[number];

		for (const grade of institution.supportedGrades) {
			let databaseLearner = mappedDatabaseLearner[grade];
			let listLearner = mappedListLearner[grade];
			if (!Array.isArray(listLearner) || listLearner.length === 0) {
				continue;
			}
			databaseLearner.forEach(learner => {
				// If learner has a birth certificate number
				if (learner.birthCertificateNo) {
					// todo: set up binary search to reduce time
					let filteredLearnerLocation = [] as number[];
					let i = 0;
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
		console.timeEnd('sync');
		logger.debug('local database has been synced');
	} catch (err) {
		throw err;
	}
};

export { sync };
