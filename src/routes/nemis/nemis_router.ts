import { Router } from "express";
import list_learners from "../../middleware/nemis/list_learners";
import set_cookie from "../../middleware/nemis/set_cookie";
import { captureRoute } from "./capture_router";
import { admitRoute } from "./admit_router";
import search from "../../middleware/nemis/search";

const nemisRoute = Router();

nemisRoute.use("/capture", captureRoute);
nemisRoute.use("/admit", admitRoute);

nemisRoute.get("/list/learners", set_cookie, list_learners);
nemisRoute.get("/search/:uniqueIdentifier", search);

export {
    nemisRoute
};
