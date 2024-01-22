/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import connectDb from './src/database/index';
import { mkdir } from 'fs/promises';
import * as process from 'process';

export default async () => {
    let homeDir = process.env.HOME_DIR;
    try {
        switch (true) {
            case !homeDir:
                homeDir = `${process.cwd()}/data`;
                process.env.HOME_DIR = homeDir;
                break;

            case !process.env.BASE_URL:
                process.env.BASE_URL = 'http://nemis.education.go.ke'; // https is not supported
                break;

            case !process.env.DATABASE_URL:
                throw new Error('Database URL is not defined. Exiting...');

            case !process.env.NEMIS_API_AUTH:
                throw new Error('NEMIS API authorization key is not defined. Exiting...');

            case !process.env.ENCRYPTION_KEY:
                throw new Error('Encryption Key is not defined. Exiting...');
        }

        // Wait database to connect
        await connectDb(process.env.DATABASE_URL!);
        console.info('Database connected ✨');

        // Check if the data directory is available.
        console.log('Creating data directory.');
        await mkdir(homeDir! + '/debug', { recursive: true }).catch(err => {
            if (err.code === 'EEXIST') console.log(err.message);
            else throw err;
        });

        process.env.DATA_DIR = homeDir;
        process.env.DEBUG_DIR = `${homeDir}/debug`;
    } catch (err) {
        throw err;
    }
};
