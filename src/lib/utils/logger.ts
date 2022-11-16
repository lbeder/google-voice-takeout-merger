/* eslint-disable no-console */
import chalk from "chalk";
import consoleStamp from "console-stamp";

consoleStamp(console, { format: ":date(yyyy/mm/dd HH:MM:ss.l)" });

export default class Logger {
  public static verbose: boolean;

  public static setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  public static info(...args: unknown[]) {
    console.log(chalk.cyanBright(...args));
  }

  public static debug(...args: unknown[]) {
    if (!this.verbose) {
      return;
    }

    console.debug(chalk.yellow(...args));
  }

  public static error(...args: unknown[]) {
    console.log(chalk.bold.red(...args));
  }

  public static warning(...args: unknown[]) {
    console.warn(chalk.hex("#FFA500")(...args));
  }
}
