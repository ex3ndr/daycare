import http from "node:http";

export type SocketResponse = {
  statusCode: number;
  body: string;
};

export type SocketRequestOptions = {
  socketPath: string;
  path: string;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
};

export function requestSocket(options: SocketRequestOptions): Promise<SocketResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath: options.socketPath,
        path: options.path,
        method: options.method ?? "GET",
        headers: options.headers
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}
