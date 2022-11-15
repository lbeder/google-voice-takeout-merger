import chalk from "chalk";
import consoleStamp from "console-stamp";

consoleStamp(console, { format: ":date(yyyy/mm/dd HH:MM:ss.l)" });

export default class Logger {
  public static verbose: boolean = false;

  public static setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  public static info(...args: any[]) {
    console.log(chalk.cyanBright(...args));
  }

  public static debug(...args: any[]) {
    if (!this.verbose) {
      return;
    }

    console.debug(chalk.gray(...args));
  }

  public static error(...args: any[]) {
    console.error(chalk.bold.red(...args));
  }

  public static warning(...args: any[]) {
    console.warn(chalk.hex("#FFA500")(...args));
  }
}
