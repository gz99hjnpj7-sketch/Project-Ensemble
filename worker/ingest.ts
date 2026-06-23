import { runIngestion } from "@/ensemble/ingestion/run";

runIngestion()
  .then((summary) => console.log(JSON.stringify(summary, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
