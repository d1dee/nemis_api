/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { JwtPayload } from 'jsonwebtoken';
import send_response from '@middleware/utils/send_response';
import { DatabaseInstitution, DatabaseToken } from '../nemisApiTypes';
import { NemisWebService } from '@libs/nemis/nemis_web_handler';
import { z as zod } from 'zod';
import { queryParameterSchema } from '@middleware/utils/query_params';

declare module 'express-serve-static-core' {
	export interface Request {
		/**
		 * A class to handle all interactions with the NEMIS (National Education Management Information System) website
		 * located at nemis.education.go.ke. This class provides methods to log in to the
		 * website and handle all interactions available on the website. It uses the axios to
		 * automate browser interaction and perform tasks on the website. The class encapsulates all the logic
		 * and handles all the details of interacting with the website, making it easier to use and maintain in
		 * other parts of the application. It also provides error handling and logging functionality to help
		 * diagnose and troubleshoot issues. Overall, this class provides a convenient and reliable way to interact
		 * with the NEMIS website and automate tasks related to managing education data.
		 */
		nemis: NemisWebService;
		isValidToken: boolean;
		decodedToken: JwtPayload;
		institution: DatabaseInstitution;
		token: DatabaseToken;
		sendResponse: send_response;
		queryParams: zod.infer<typeof queryParameterSchema>;
	}
}
