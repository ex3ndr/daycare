declare module "pm2" {
  export type ProcessDescription = {
    name?: string;
    pm_id?: number;
    pid?: number;
    status?: string;
  };

  export type StartOptions = {
    name?: string;
    script?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    interpreter?: string;
    instances?: number | "max";
    watch?: boolean | string[];
    autorestart?: boolean;
    max_restarts?: number;
    min_uptime?: number;
  };

  type Callback = (error?: Error | null) => void;

  const pm2: {
    connect: (callback: Callback) => void;
    disconnect: (callback?: Callback) => void;
    start: (options: StartOptions, callback: Callback) => void;
    stop: (id: string | number, callback: Callback) => void;
    restart: (id: string | number, callback: Callback) => void;
    delete: (id: string | number, callback: Callback) => void;
    list: (
      callback: (error?: Error | null, list?: ProcessDescription[]) => void
    ) => void;
  };

  export default pm2;
}
