/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { z } from "zod";
import institution from "@database/institution";

const usernamePasswordSchema = z.object({
    username: z
        .string({
            required_error:
                'Username is required. Note it should be the same as the username used to login to NEMIS website',
            invalid_type_error: 'Username must be of type string'
        })
        .trim()
        .min(4, 'Username too short'),
    password: z
        .string({
            required_error:
                'Password is required. Note it should be the same as the password used to login to NEMIS website',
            invalid_type_error: 'Password must be of type string.'
        })
        .min(1, 'Password can not be blank.')
});

const newInstitutionSchema = usernamePasswordSchema.transform(async (x, ctx) => {
    let isRegistered = await institution.findOne({ username: { $eq: x.username } });
    // If not archived we need to refresh token not register.
    if (!isRegistered || isRegistered?.archived?.isArchived)
        return { ...x, previousRegistration: isRegistered };
    else {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Username ' + x.username + ' is already registered.',
            path: ['username']
        });
        return z.NEVER;
    }
});

const uniqueIdentifierSchema = z.string({
    required_error:
        'Unique identifier missing.To delete a learner, a unique identifier must be provided. The identifier can be either the UPI, birth certificate number, or admission number.',
    invalid_type_error: ' Unique identifier must be of type string.'
});

export { usernamePasswordSchema, newInstitutionSchema, uniqueIdentifierSchema };
