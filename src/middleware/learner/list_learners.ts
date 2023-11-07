/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */
import { Request } from "express";
import { sendErrorMessage } from "@middleware/utils/middleware_error_handler";
import { z } from "zod";
import { genderSchema, gradesSchema } from "@libs/zod_validation";
import learnerModel from "@database/learner";
import { sub } from "date-fns";

export default async function (req: Request) {
    try {
        // Validate req.query
        let query = z
            .object({
                limit: z.coerce
                    .number({ invalid_type_error: 'Limit must be a number.' })
                    .multipleOf(10, 'Limit must be multiple of 10'),
                grade: gradesSchema,
                gender: genderSchema,
                transferred: z.enum(['in', 'out']),
                stream: z.coerce.string(),
                withUpi: z.coerce
                    .string()
                    .toLowerCase()
                    .transform(arg => arg === 'true'),
                withError: z.coerce
                    .string()
                    .toLowerCase()
                    .transform(arg => arg === 'true'),
                name: z.coerce.string().min(3, 'Name string must be at least 3 letters long.'),
                age: z.coerce.number().min(3, 'Minimum age is 3 years')
            })
            .partial()
            .transform(value => {
                Object.assign(value, { upi: value.withUpi, error: value.withError });
                return value;
            })

            .parse(req.query);
        // Construct a database query from req.query
        let queryObject = { institutionId: req.institution._id, archived: false };

        Object.entries(query).forEach(keyValue => {
            switch (keyValue[0]) {
                case 'grade':
                case 'gender':
                case 'stream':
                    Object.assign(queryObject, { [keyValue[0]]: { $eq: keyValue[1] } });
                    break;

                case 'error':
                case 'upi':
                    if (keyValue[1] !== undefined)
                        Object.assign(queryObject, {
                            [keyValue[0]]: keyValue[1]
                                ? {
                                      $exists: true,
                                      $nin: [null, undefined, '']
                                  }
                                : { $exists: false, $in: [null, undefined, ''] }
                        });
                    break;
                case 'age':
                    if (query.age)
                        Object.assign(queryObject, {
                            dob: {
                                $lte: sub(new Date(), { years: query.age - 1, months: 6 }),
                                $gte: sub(new Date(), { years: query.age, months: 6 })
                            }
                        });
                    break;
                case 'transferred':
                    if (query.transferred === 'in') {
                        Object.assign(queryObject, { transferred: { $exists: true } });
                    }
            }
        });

        let data = query?.limit
            ? await learnerModel.find(queryObject).limit(query.limit)
            : await learnerModel.find(queryObject);

        req.respond.sendResponse(data);
    } catch (err) {
        sendErrorMessage(req, err);
    }
}
