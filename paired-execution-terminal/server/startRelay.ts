import { startExecutionRelay } from "./executionRelay";

const server = startExecutionRelay();
server.on("error", () => { process.exitCode = 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.clients.forEach(client => client.terminate());
    server.close();
  });
}
