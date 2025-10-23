import { withValidManifest } from "@coinbase/onchainkit/minikit";
import { minikitConfig } from "../../../minikit.config";

{
  "accountAssociation": {
    "header": "eyJmaWQiOjEzOTU0MzgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhkMTU2MDljRDU1Njg3YWI5MjY4OTI2YkVFMGNjMThlMUFlMjNEMzRjIn0",
    "payload": "eyJkb21haW4iOiJydWJibGUtYXBwLnZlcmNlbC5hcHAifQ",
    "signature": "VSReLZfOqF8J6+HCpx85zN/c9P5BqX8cMPsngbdmZlcs4mSOZsyJdzzTuJtnJLHLAUihMyWGGzycc+Vj13ALZBw="
  }
}


export async function GET() {
  return Response.json(withValidManifest(minikitConfig));
}
