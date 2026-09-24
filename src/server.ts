import "dotenv/config";

import { env } from "./config/env.js";
import app from "./app.js";

app.listen(env.PORT, () => {
  console.log(`THREAD API running on http://localhost:${env.PORT}`);
});
