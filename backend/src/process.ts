export function getProcessType(): string[] {
  const args = process.argv.slice(2);
  const result: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--process') {
      // Consume subsequent args until next flag
      for (let j = i + 1; j < args.length; j++) {
        const nextArg = args[j];
        if (nextArg.startsWith('-')) {
          break;
        }
        result.push(...nextArg.split(',')); // Support comma in space-separated args too
        i = j; // Advance outer loop
      }
    } else if (arg.startsWith('--process=')) {
      const value = arg.split('=')[1];
      result.push(...value.split(','));
    } else if (!arg.startsWith('-')) {
      // positional argument
      result.push(...arg.split(','));
    }
  }

  if (result.length > 0) {
    return Array.from(new Set(result));
  }

  const env = process.env.PROCESS_TYPE;
  return env ? env.split(',') : ['all'];
}
