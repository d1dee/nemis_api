/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import CustomError from "@libs/error_handler";
import institutionModel from "@database/institution";
import { usernamePasswordSchema } from "@libs/zod_validation";
import { decryptString } from "@libs/crypt";


// Validate username and password provided by client as a JSON body aganist stored username and password
const validateUsernamePassword = async (requestBody: any) => {
    if (!requestBody)
        throw new CustomError(
            "Request body is empty, ensure at least username and password are present.",
            400
        );
    const { username, password } = usernamePasswordSchema.parse(requestBody);
    
    if (!username && !password) {
        throw new CustomError("Failed to validate username and password from the JSON body.");
    }
    
    let institution = await institutionModel.find({ username: { $eq: username } });
    
    if (institution.length < 1)
        throw new CustomError(
            "No institution with the provided username exists, Please register for a new account at `/auth/register`",
            401
        );
    if (institution.length > 1)
        throw new CustomError(
            "Multiple institutions were return with the provided username. kindly use the same username as the one used to login to nemis website.",
            400
        );
    
    if (password !== decryptString(institution[0].password))
        throw new CustomError(
            "The provided password is incorrect. Use the same password that is used to login to nemis website. If the password was recently updated, use the old password and then call /institution/update with the new password to sync with the nemis website.",
            401
        );
    return institution[0];
};

export { validateUsernamePassword };
