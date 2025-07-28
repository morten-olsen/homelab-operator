class LogService {
  public debug = (message: string, data?: Record<string, unknown>) => {
    console.debug(message, data);
  };

  public info = (message: string, data?: Record<string, unknown>) => {
    console.info(message, data);
  };

  public warn = (message: string, data?: Record<string, unknown>) => {
    console.warn(message, data);
  };

  public error = (message: string, data?: Record<string, unknown>) => {
    console.error(message, data);
  };
}

export { LogService };
