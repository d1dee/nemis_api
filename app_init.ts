/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import connectDb from "./src/database/index";

export default async () => {
    try {
        switch (true) {
            case !process.env.HOME_DIR:
                process.env.HOME_DIR = `${process.cwd()}/data`;
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
        await connectDb(process.env.DATBASE_URL!);

        console.info('Database connected ✨');
    } catch (err) {
        throw err;
    }
};
