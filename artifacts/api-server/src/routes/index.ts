import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customersRouter from "./customers";
import materialsRouter from "./materials";
import quotesRouter from "./quotes";
import bookingsRouter from "./bookings";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customersRouter);
router.use(materialsRouter);
router.use(quotesRouter);
router.use(bookingsRouter);
router.use(dashboardRouter);
router.use(storageRouter);

export default router;
