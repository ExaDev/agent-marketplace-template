/** Collects every violation a check finds so one run reports them all. */
export class Problems {
  readonly messages: string[] = [];

  add(message: string): void {
    this.messages.push(message);
  }

  get any(): boolean {
    return this.messages.length > 0;
  }

  /** Prints each problem to stderr and returns the process exit code the check should use. */
  report(checkName: string): number {
    if (!this.any) {
      console.log(`${checkName}: ok`);
      return 0;
    }
    for (const message of this.messages) console.error(`${checkName}: ${message}`);
    return 1;
  }
}
