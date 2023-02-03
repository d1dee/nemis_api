/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {NextFunction, Request, Response} from 'express';
import {ExtendedRequest} from '../interfaces';
import logger from '../libs/logger';

//main class used to hand all responses to the client
export default class {
	#request: Request;
	#response: Response;
	#next: NextFunction;

	set(req: ExtendedRequest, res: Response, next: NextFunction) {
		this.#request = req;
		this.#response = res;
		this.#next = next;
		next();
	}

	// Set headers
	setHeaders(headerObject) {
		if (Object.keys(headerObject).length === 0) {
			return;
		}
		let cookieEntries = Object.entries(headerObject).filter(x => x.length === 2 && !!x[1]);
		cookieEntries.every(x => {
			this.#response.cookie(x[0], x[1]);
		});
	}

	// Set cookie
	/*setCookies(cookieObject: SetCookie) {
		if (Object.keys(cookieObject).length === 0) {
			return;
		}
		let cookieEntries = Object.entries(cookieObject).filter(x => x.length === 2 && !!x[1]);
		cookieEntries.every(x => {
			this.#response.cookie(x[0], x[1]);
		});
	}*/

	//Generate generic error response
	error(errorCode: number, message?: string, cause?: any) {
		//check if response has been sent
		switch (errorCode) {
			case 400:
				this.#response.status(400).json({
					success: false,
					message: message || 'Bad Request',
					cause: cause || undefined
				});
				break;
			case 401:
				this.#response.status(401).json({
					success: false,
					message: message || 'Unauthorized',
					cause: cause || undefined
				});
				break;
			case 403:
				this.#response.status(403).json({
					success: false,
					message: message || 'Forbidden',
					cause: cause || undefined
				});
				break;
			case 404:
				this.#response.status(404).json({
					success: false,
					message: message || 'Not Found',
					cause: cause || undefined
				});
				break;
			case 405:
				this.#response.status(405).json({
					success: false,
					message: message || 'Method Not Allowed',
					cause: cause || undefined
				});
				break;
			case 408:
				this.#response.status(408).json({
					success: false,
					message: message || 'Request Timeout',
					cause: cause || undefined
				});
				break;
			case 409:
				this.#response.status(409).json({
					success: false,
					message: message || 'Conflict',
					cause: cause || undefined
				});
				break;
			case 413:
				this.#response.status(413).json({
					success: false,
					message: message || 'Payload Too Large',
					cause: cause || undefined
				});
				break;
			case 415:
				this.#response.status(415).json({
					success: false,
					message: message || 'Unsupported Media Type',
					cause: cause || undefined
				});
				break;
			case 429:
				this.#response.status(429).json({
					success: false,
					message: message || 'Too Many Requests',
					cause: cause || undefined
				});
				break;

			case 500:
				this.#response.status(500).json({
					success: false,
					message: message || 'Internal Server Error',
					cause: cause || undefined
				});
				break;
			case 502:
				this.#response.status(502).json({
					success: false,
					message: message || 'Bad Gateway',
					cause: cause || undefined
				});
				break;
			case 503:
				this.#response.status(503).json({
					success: false,
					message: message || 'Service Unavailable',
					cause: cause || undefined
				});
				break;
			case 504:
				this.#response.status(504).json({
					success: false,
					message: message || 'Gateway Timeout',
					cause: cause || undefined
				});
				break;
			case 505:
				this.#response.status(505).json({
					success: false,
					message: message || 'HTTP Version Not Supported',
					cause: cause || undefined
				});
				break;
			case 511:
				this.#response.status(511).json({
					success: false,
					message: message || 'Network Authentication Required',
					cause: cause || undefined
				});
				break;
			default:
				this.#response.status(errorCode).json({
					success: false,
					message: message,
					cause: cause || undefined
				});
				break;
		}
	}

	//method used to send a response to the client
	respond(data: any, message?: string, statusCode?: number) {
		statusCode = statusCode || 200;
		//check if response has been sent
		if (this.#response?.headersSent) {
			return logger.warn('Headers sent');
		}
		if (!message) {
			message = undefined;
		}
		//check if response is an error
		if (data instanceof Error) {
			//logger.error(data);
			this.#response.status(500).send({
				success: false,
				message: 'Internal Server Error',
				cause: data.cause || undefined
			});
		} else {
			//send the response to the client
			this.#response.status(statusCode).send({
				success: true,
				message: message || 'Operation complete successfully',
				data: data
			});
		}
	}

	private validateDataBeforeSend(data: any) {
		//check if array or object
		//if array check length and content type
		//if we find object call object
		//if object loop through contents and validate
		//if we find array call array
	}
}
