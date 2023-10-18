/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import * as winston from 'winston';
import {createLogger, format, transports} from 'winston';

const logLevels = {
	fatal: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
	trace: 5
};
const logColors = {
	trace: 'magenta',
	input: 'grey',
	verbose: 'cyan',
	prompt: 'grey',
	debug: 'blue',
	info: 'green',
	data: 'grey',
	help: 'cyan',
	warn: 'yellow',
	error: 'red'
};

let logger: winston.Logger;
if (process.env.NODE_ENV !== 'production') {
	logger = createLogger({
		levels: logLevels,
		transports: [
			new transports.Console({level: 'trace'}),
			new transports.File({filename: 'combined.log', level: 'info'})
		],
		format: format.combine(
			format.colorize({all: true, colors: logColors}),
			format.timestamp({format: 'HH:mm:ss'}),
			format.splat(),
			format.json(),
			format.printf(info => `[${info.timestamp}] => [${info.level}] ${info.message}`)
		)
	});
} else {
	logger = createLogger({
		levels: logLevels,
		transports: [
			new transports.Console({level: 'trace'}),
			new transports.File({filename: 'combined.log', level: 'debug'})
		],
		format: format.combine(
			format.colorize({all: true, colors: logColors}),
			format.timestamp({format: 'HH:mm:ss'}),
			format.splat(),
			format.json(),
			format.printf(info => `[${info.timestamp}] => [${info.level}] ${info.message}`)
		)
	});
}

export default logger;