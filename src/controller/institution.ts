/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import * as jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {randomFillSync} from 'node:crypto';
import archivedInstitutionModel from '../database/archive_institution';
import institutionModel from '../database/institution';
import tokenModel from '../database/token';
import {DbInstitution} from '../interfaces';
import logger from '../libs/logger';
import {Nemis} from '../libs/nemis';
import {TokenFromDb} from '../middleware/interfaces';

async function __getInst(username: string, password: string): Promise<DbInstitution> {
	// noinspection ExceptionCaughtLocallyJS
	try {
		const nemis = new Nemis();
		const cookie = await nemis.login(username, password);

		let institution: DbInstitution = await nemis.getInstitution();

		if (!institution || typeof institution !== 'object') {
			throw new Error('Institution info not found, Invalid institution info.');
		}
		institution.username = username;
		institution.password = password;
		institution.cookie = {value: cookie, expires: Date.now() + 3.6e6};
		return institution;
	} catch (err) {
		throw err;
	}
}

const registerInstitution = async (
	username: string,
	password: string
): Promise<{institution: DbInstitution; token: TokenFromDb}> => {
	try {
		let institution = await __getInst(username, password);
		// Check if the institution is already registered and archived
		let archivedInstitution = await institutionModel.findOne({
			username: username,
			archived: true
		});
		let institutionDoc;
		if (archivedInstitution) {
			institutionDoc = await institutionModel.findByIdAndUpdate(archivedInstitution._id, {
				archived: false,
				password: password,
				cookie: institution.cookie
			});
		} else {
			institutionDoc = await institutionModel.create(institution);
		}

		if (!institutionDoc) {
			throw new Error('Institution not created, Invalid institution info');
		}

		logger.debug(`Institution created ${institutionDoc.code}`);
		let tokenSecret = randomFillSync(Buffer.alloc(32)).toString('hex');
		logger.trace('Token secret: ' + tokenSecret);

		let tokenDoc = await tokenModel.create({
			token: '',
			tokenSecret: tokenSecret,
			institutionId: institutionDoc._id
		});

		let token = jwt.sign(
			{
				username: institutionDoc.username,
				id: tokenDoc._id
			},
			tokenSecret,
			{expiresIn: '30 d'}
		);

		await tokenDoc.updateOne({token: token});
		logger.trace('Token doc: ' + tokenDoc);
		await institutionDoc.updateOne({token: tokenDoc._id});

		return {
			institution: {...institutionDoc.toObject(), archived: false},
			token: {...tokenDoc.toObject(), token: token}
		};
	} catch (err) {
		/*if(err?.code=== 11000){
			throw new Error(err?.message)
		}*/
		throw err;
	}
};

const updateInstitution = async (
	username: string,
	password: string,
	institutionId: string
): Promise<DbInstitution> => {
	try {
		let institution = await __getInst(username, password);
		institution = (await institutionModel
			.findByIdAndUpdate(institutionId, institution)
			.lean()) as DbInstitution;
		if (!institution) {
			throw new Error('Institution not updated, Invalid institution info');
		} else {
			delete institution.password;
			delete institution.cookie;
			delete institution.__v;
			delete institution._id;

			return institution;
		}
	} catch (err) {
		throw err;
	}
};

const archiveInstitution = async (institutionId: string, tokenId: string): Promise<boolean> => {
	try {
		if (mongoose.isValidObjectId(institutionId) && mongoose.isValidObjectId(tokenId)) {
			await institutionModel.findByIdAndUpdate(institutionId, {
				archived: true
			});
			await tokenModel.findByIdAndUpdate(tokenId, {archived: true});
			await archivedInstitutionModel.create({
				institutionId: institutionId,
				tokenId: tokenId
			});

			return true;
		} else {
			return false;
		}
	} catch (err) {
		throw err;
	}
};

export {updateInstitution, registerInstitution, archiveInstitution};