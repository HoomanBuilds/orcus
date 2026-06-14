import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  agentPk:        required("AGENT_PRIVATE_KEY"),
  agentEciesSk:   required("AGENT_ECIES_PRIVATE_KEY"),
  storageIndexer: required("STORAGE_INDEXER"),
};
