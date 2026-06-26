import type { Request, Response } from "express";
import type { ProviderMetadataService } from "../domain/providerMetadataService.js";

export function providerController(provider: ProviderMetadataService) {
  return {
    async getMetadata(_req: Request, res: Response) {
      res.status(200).json(provider.getMetadata());
    },
  };
}
