import { Request } from "express";
import { GRADES } from "../../libs/zod_validation";

export default async (req: Request) => {
    try {
        let nemis = req.nemis;
        let listLearnerPromises = [];
        for await (const grade of GRADES) {
            if (!grade.startsWith("form")) continue;
            listLearnerPromises.push(await nemis.listLearners(grade));
        }
        console.log(listLearnerPromises);
    } catch (err: any) {
        req.sendResponse.error(err?.code || 500, err?.message || "Internal server Error");
    }
}