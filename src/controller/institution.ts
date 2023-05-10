/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import * as jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { randomFillSync } from 'node:crypto';
import institutionModel from '../database/institution';
import tokenModel from '../database/token';
import CustomError from '../libs/error_handler';
import { Institution, RegisterNewInstitution } from '../../types/nemisApiTypes';
import learner from '../database/learner';
import { NemisWebService } from '../libs/nemis/nemis_web_handler';

async function __getInst(
	username: string,
	password: string
): Promise<
	Institution & {
	username: string;
	password: string;
	cookie: { value: string; expires: number };
}
> {
	try {
		const nemis = new NemisWebService();
		const cookie = await nemis.login(username, password);

		let institution = await nemis.getInstitution();
		if (!institution || typeof institution !== 'object') {
			throw new CustomError(
				'No valid institution information was returned, check your credentials and try again',
				401,
				'Unauthorized'
			);
		}
		return {
			...institution,
			username: username,
			password: password,
			cookie: { value: cookie, expires: Date.now() + 3.6e6 }
		};
	} catch (err) {
		throw err;
	}
}

const registerInstitution = async (registerInstitutionObject: RegisterNewInstitution) => {
	try {
		const { username, password, _id } = registerInstitutionObject;
		let institution = await __getInst(username, password);

		let institutionDocument;
		if (_id) {
			let reRegisterDocument = await Promise.all([
				institutionModel
					.findByIdAndUpdate(_id, {
						isArchived: false,
						username: username,
						password: password,
						cookie: institution.cookie
					})
					.lean()
			]);
			institutionDocument = reRegisterDocument.shift();
		} else {
			institutionDocument = await institutionModel.create({
				...institution,
				username: username,
				password: password,
				isArchived: false
			});
		}
		if (!institutionDocument) {
			throw new CustomError(
				'Institution not created, Invalid institution info',
				500,
				'database_error'
			);
		}
		let tokenSecret = randomFillSync(Buffer.alloc(32)).toString('hex'); //todo: hash token secret

		let tokenDocument = await tokenModel.create({
			token: '',
			tokenSecret: tokenSecret,
			institutionId: institutionDocument._id
		});

		let token = jwt.sign(
			{
				id: tokenDocument._id
			},
			tokenSecret,
			{ expiresIn: '30 d' }
		);

		let returnPromise = await Promise.all([
			tokenModel
				.findByIdAndUpdate(tokenDocument._id, { token: token }, { returnDocument: 'after' })
				.lean(),
			institutionModel
				.findByIdAndUpdate(
					institutionDocument._id,
					{ token: tokenDocument._id },
					{ returnDocument: 'after' }
				)
				.lean()
		]);
		let tokenUpdate = returnPromise[0];
		let institutionUpdate = returnPromise[1];
		if (tokenUpdate?._id && institutionUpdate?._id) {
			return {
				...institutionUpdate,
				...tokenUpdate
			};
		} else
			throw new CustomError(
				'Failed to save hashed token and institution info',
				500,
				'database_error'
			);
	} catch (err) {
		throw err;
	}
};

const updateInstitution = async (
	username: string,
	password: string,
	institutionId: string
): Promise<
	Institution & { username: string; password: string; cookie: { value: string; expires: number } }
> => {
	try {
		let institution = await __getInst(username, password);
		await institutionModel.findByIdAndUpdate(institutionId, institution).lean();
		if (!institution) {
			throw new Error('Institution not updated, Invalid institution info');
		} else {
			return institution;
		}
	} catch (err) {
		throw err;
	}
};

const archiveInstitution = async (
	institutionId: mongoose.Types.ObjectId,
	tokenId: mongoose.Types.ObjectId
): Promise<boolean> => {
	try {
		if (mongoose.isValidObjectId(institutionId) && mongoose.isValidObjectId(tokenId)) {
			await Promise.all([
				institutionModel.findByIdAndUpdate(institutionId, {
					isArchived: true
				}),
				tokenModel.findByIdAndUpdate(tokenId, {
					archived: true,
					revoked: {
						on: Date.now(),
						by: institutionId,
						reason: 'institution was archived'
					}
				}),
				learner.update({ institutionId: institutionId }, { archived: true })
			]);
			return true;
		} else {
			return false;
		}
	} catch (err) {
		throw err;
	}
};

export { updateInstitution, registerInstitution, archiveInstitution };
