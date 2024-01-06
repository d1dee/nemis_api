/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import { z } from "zod";
import { Z_ID, Z_NAMES, Z_NUMBER_STRING, Z_PHONE_NUMBER, Z_STRING, Z_TRANSFER_METHOD } from "@libs/constants";

export const Z_PARENT_CONTACTS = z.object({
    fatherName: Z_NAMES,
    fatherTel: Z_PHONE_NUMBER,
    fatherId: Z_ID,
    motherName: Z_NAMES,
    motherTel: Z_PHONE_NUMBER,
    motherId: Z_ID,
    guardianName: Z_NAMES,
    guardianTel: Z_PHONE_NUMBER,
    guardianId: Z_ID,
    address: Z_NUMBER_STRING
});

export const Z_TRANSFER = z.object({
    transferredOn: z.coerce.date(),
    transferReason: Z_STRING,
    transferMethod: Z_TRANSFER_METHOD,
    transferredFrom: Z_STRING
});
/*.transform(transferInfo =>

);*/

export const Z_STRING_TO_ARRAY = Z_STRING.transform((val) => val.split(","));
