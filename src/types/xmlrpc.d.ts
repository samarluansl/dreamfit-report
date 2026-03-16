declare module 'xmlrpc' {
  type Value = string | number | boolean | null | Value[] | Record<string, Value>;

  interface ClientOptions {
    host: string;
    port: number;
    path: string;
  }

  interface Client {
    methodCall(
      method: string,
      params: Value[],
      callback: (error: Error | undefined, value: unknown) => void
    ): void;
  }

  function createClient(options: ClientOptions): Client;
  function createSecureClient(options: ClientOptions): Client;
}
