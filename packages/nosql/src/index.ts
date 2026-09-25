import mongoose from "mongoose";

declare global {
  // Survives module reloads in dev, so an edit doesn't open another connection.
  // eslint-disable-next-line no-var
  var peskasMongo: Record<string, Promise<unknown>> | undefined;
}

const OPTIONS = {
  bufferCommands: false, // fail fast instead of queueing while disconnected
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 30000,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  retryReads: true,
};

/** Open a connection once per process and reuse it; a failed attempt is retried on the next call. */
function once<T>(key: string, open: () => Promise<T>): Promise<T> {
  const cache = (globalThis.peskasMongo ??= {});
  return (cache[key] ??= open().catch((error: unknown) => {
    delete cache[key];
    throw error;
  })) as Promise<T>;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not defined`);
  return value;
}

/** Default connection (`MONGODB_URI`): the portal summaries every model reads. */
export default function getDb() {
  return once("summaries", async () => mongoose.connect(requireEnv("MONGODB_URI"), { ...OPTIONS, maxPoolSize: 10 }));
}

/** Coasts connection (`MONGODB_URI_COASTS`): only the `wio_gaul2` boundaries. */
export function getPortalDb() {
  return once("coasts", async () =>
    mongoose.createConnection(requireEnv("MONGODB_URI_COASTS"), { ...OPTIONS, maxPoolSize: 5 }).asPromise()
  );
}
