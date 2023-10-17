/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import { Request } from 'express';
import { newInstitutionSchema } from '../../libs/zod_validation';
import { sendErrorMessage } from '../utils/middleware_error_handler';
import institutionModel from '../../database/institution';
import { randomFillSync } from 'node:crypto';
import tokenModel from '../../database/token';
import * as jwt from 'jsonwebtoken';
import { NemisWebService } from '../../libs/nemis/nemis_web_handler';

export default async (req: Request) => {
	try {
		const { username, password } = await newInstitutionSchema.parseAsync(req.body);

		const nemis = new NemisWebService();

		await nemis.login(username, password);

		let institution = await nemis.getInstitution(username);

		let institutionDocument = await institutionModel.findOneAndUpdate(
			{ username: username },
			{
				...institution,
				username: username,
				password: password,
				isArchived: false
			},
			{ upsert: true, returnDocument: 'after' }
		);

		let tokenSecret = randomFillSync(Buffer.alloc(32)).toString('hex'); //todo: hash token secret

		let tokenDocument = await tokenModel.create({
			token: '',
			tokenSecret: tokenSecret,
			institutionId: institutionDocument._id
		});

		Object.assign(tokenDocument, {
			token: jwt.sign(
				{
					id: tokenDocument._id
				},
				tokenSecret,
				{ expiresIn: '30 d' }
			)
		});

		Object.assign(institutionDocument, {
			token: tokenDocument._id
		});

		await Promise.all([tokenDocument.save(), institutionDocument.save()]);

		return req.sendResponse.respond(
			{
				...institutionDocument.toObject(),
				token: tokenDocument.token,
				expires: tokenDocument.expires
			},
			'Institution registered successfully.',
			201
		);
	} catch (err: any) {
		sendErrorMessage(req, err);
	}
};
