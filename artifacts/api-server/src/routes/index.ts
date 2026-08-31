import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customersRouter from "./customers";
import materialsRouter from "./materials";
import quotesRouter from "./quotes";
import bookingsRouter from "./bookings";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import teamRouter from "./team";
import timeRouter from "./time";
import portfolioRouter from "./portfolio";
import referralsRouter from "./referrals";
import pdfRouter from "./pdf";
import masterProjectsRouter from "./master-projects";
import profilesRouter from "./profiles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customersRouter);
router.use(materialsRouter);
router.use(quotesRouter);
router.use(bookingsRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(teamRouter);
router.use(timeRouter);
router.use(portfolioRouter);
router.use(referralsRouter);
router.use(pdfRouter);
router.use(masterProjectsRouter);
router.use(profilesRouter);

export default router;
