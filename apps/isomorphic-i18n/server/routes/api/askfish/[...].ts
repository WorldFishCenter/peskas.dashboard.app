import { handleAskFish } from "@isomorphic/api/askfish";
import { defineHandler } from "nitro/h3";

// What the AskFish service reads, server to server: catalog, query and catch-trends.
export default defineHandler((event) => handleAskFish(event.req));
