
import dotenv from "dotenv";
import { EventLogger } from "./eventLogger";
dotenv.config();



// const BATCH_SIZE = 10000;

// // Validate environment variables
function validateEnv() {
  const required = [
    "SEPOLIA_RPC_URL",
    "CONTRACT_ADDRESS",
    "START_BLOCK_NUMBER",
  ];
  for (const req of required) {
    if (!process.env[req]) {
      throw new Error(`Please set ${req} in .env file`);
    }
  }
}
async function main() {
  const logger = new EventLogger();
  try {
    validateEnv();
    
    try{
      await logger.run();
    } catch (error) {
      console.error("Error in main:", error);
      process.exit(1);
    }

  } catch (error) {
    console.error("Error in main:", error);
    logger.shutdown();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error in main:", error);
  process.exit(1);
});

