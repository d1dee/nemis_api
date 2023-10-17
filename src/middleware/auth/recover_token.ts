import CustomError from '@libs/error_handler';
import { usernamePasswordSchema } from '@libs/zod_validation';
import { sendErrorMessage } from '@middleware/utils/middleware_error_handler';
import { Request } from 'express';
import institutionModel from '@database/institution';
import { decryptString } from '@libs/crypt';
import { DatabaseToken } from 'types/nemisApiTypes';

export default async (req: Request) => {
    try {
        const { username, password } = usernamePasswordSchema.parse(req.body);

        if (!username && !password) {
            throw new CustomError('Failed to validate username and password from the JSON body.');
        }

        let institution = await institutionModel.find({ username: { $eq: username } });

        if (institution.length < 1)
            throw new CustomError(
                'No institution with the provided username exists, Please register for a new acccount at `/auth/register`',
                401
            );
        if (institution.length > 1)
            throw new CustomError(
                'Multiple institutions were return with the provided username. kindly use the same username as the one used to login to nemis website.',
                400
            );

        if (password !== decryptString(institution[0].password))
            throw new CustomError(
                'The provided password is incorrect. Use the same password that is used to login to nemis website. If the password was recently updated, use the old password and then call /institution/update with the new password to sync with the nemis website.',
                401
            );
        let token = (await institution[0].populate('token')).token as DatabaseToken | undefined;

        if (!token) throw new CustomError('No valid token associated with the institution.', 400);

        // Check whether token has expoired
        if (token.expires.getTime() < Date.now())
            throw new CustomError('Token has expired. To renew token, use `/auth/refresh`.', 401);
        // Send token saved in Database
        req.sendResponse.respond(institution[0], 'Token recovered succesfully.');
    } catch (error: any) {
        console.error(JSON.stringify(error));
        sendErrorMessage(req, error);
    }
};
