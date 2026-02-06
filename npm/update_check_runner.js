const { refreshCache } = require('./update_check');

async function main() {
  // Background refresh only; do not print from here.
  await refreshCache();
}

main().catch(() => {});
