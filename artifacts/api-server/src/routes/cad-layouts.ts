import { Router, type IRouter } from "express";
import {
  CreateCadLayoutBody,
  CreateCadLayoutParams,
  GetLatestCadLayoutParams,
} from "@workspace/api-zod";
import { getAuthenticatedClerkUserId } from "../middlewares/apiAuth";
import {
  createCadLayoutForOwnedQuote,
  getLatestCadLayoutForOwnedQuote,
} from "../services/cadLayouts";
import { CadGenerationError } from "../services/cadFromText";

const router: IRouter = Router();

router.get("/quotes/:quoteId/cad-layouts", async (req, res): Promise<void> => {
  const params = GetLatestCadLayoutParams.strict().safeParse(req.params);
  if (!params.success) {
    res.status(400).json({
      error: "Invalid CAD layout request",
      details: params.error.flatten(),
    });
    return;
  }

  try {
    const layout = await getLatestCadLayoutForOwnedQuote({
      quoteId: params.data.quoteId,
      clerkUserId: getAuthenticatedClerkUserId(req),
    });

    if (!layout) {
      res.status(404).json({ error: "CAD layout not found" });
      return;
    }

    res.status(200).json(layout);
  } catch (error) {
    req.log.error(
      { err: error, quoteId: params.data.quoteId },
      "Failed to retrieve CAD layout",
    );
    res.status(500).json({ error: "Unable to retrieve CAD layout" });
  }
});

router.post("/quotes/:quoteId/cad-layouts", async (req, res): Promise<void> => {
  const params = CreateCadLayoutParams.strict().safeParse(req.params);
  const body = CreateCadLayoutBody.strict().safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({
      error: "Invalid CAD layout request",
      details: {
        params: params.success ? undefined : params.error.flatten(),
        body: body.success ? undefined : body.error.flatten(),
      },
    });
    return;
  }

  const prompt = body.data.prompt.trim();
  if (!prompt) {
    res.status(400).json({ error: "Prompt must contain meaningful text" });
    return;
  }

  try {
    const clerkUserId = getAuthenticatedClerkUserId(req);
    const created = await createCadLayoutForOwnedQuote({
      quoteId: params.data.quoteId,
      clerkUserId,
      prompt,
    });

    if (!created) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof CadGenerationError) {
      res.status(422).json({ error: error.message });
      return;
    }

    req.log.error(
      { err: error, quoteId: params.data.quoteId },
      "Failed to generate CAD layout",
    );
    res.status(500).json({ error: "Unable to generate CAD layout" });
  }
});

export default router;
