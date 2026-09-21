/** Scripts run outside Next, which loads .env.local on its own. */
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file)
    } catch {
      // absent is fine
    }
  }
}
