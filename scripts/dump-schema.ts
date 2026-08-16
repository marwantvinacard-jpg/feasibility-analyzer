import { jsonSchemaFor, MarketSchema } from "../lib/engine/schemas";
process.stdout.write(JSON.stringify(jsonSchemaFor("market", MarketSchema)));
