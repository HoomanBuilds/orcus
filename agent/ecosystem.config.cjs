// pm2 process config for all Orcus chain agents.
//   pm2 start ecosystem.config.cjs   # start all (5 EVM + Sui)
//   pm2 logs                         # tail logs   |  pm2 logs orcus-galileo
//   pm2 stop all / pm2 restart all / pm2 delete all
//   pm2 save && pm2 startup          # persist across reboots
// Web runs separately (cd ../web && npm run dev) — it is intentionally not managed here.
const tsx = "./node_modules/.bin/tsx";

function evm(chain) {
  return {
    name: `orcus-${chain}`,
    cwd: __dirname,
    script: tsx,
    args: "src/index.ts",
    interpreter: "none",
    env: { CHAIN: chain },
    autorestart: true,
    max_restarts: 20,
    restart_delay: 5000,
    time: true,
  };
}

module.exports = {
  apps: [
    evm("galileo"),
    evm("arbitrum-sepolia"),
    evm("base-sepolia"),
    evm("avalanche-fuji"),
    evm("mantle-sepolia"),
    {
      name: "orcus-sui",
      cwd: __dirname,
      script: tsx,
      args: "src/sui/index.ts",
      interpreter: "none",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      time: true,
    },
  ],
};
