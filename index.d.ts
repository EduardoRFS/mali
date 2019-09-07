/// <reference types="node" />

import { EventEmitter } from 'events';
import { Stream } from 'stream';
import * as grpc from 'grpc';
import * as jspb from "google-protobuf";
import { ValueOf, PickProperties } from "ts-essentials";

type NonEmptyObject<T> = keyof T extends never ? never : T;
type GetOwnProperties<T extends U, U> = Pick<T, Exclude<keyof T, keyof U>>;

type IsServiceFile<T> = NonEmptyObject<PickProperties<T, typeof grpc.Client>>;

type Request = jspb.Message;
type Response = jspb.Message;

type Method =
  | (<T extends Request>(request: T) => PromiseLike<Response>)
  | (<T extends Request>(request: T) => grpc.ClientReadableStream<Response>)
  | (() => grpc.ClientWritableStream<Request> & PromiseLike<Response>)
  | (() => grpc.ClientDuplexStream<Request, Response>);

type IsMethod<T> = T extends Method ? T : never;

type UnpackRequest<T> =
  | T extends grpc.ClientDuplexStream<infer U, infer S> ? grpc.ServerDuplexStream<S, U> : never
  | T extends grpc.ClientWritableStream<infer U> ? grpc.ClientWritableStream<U> : never;

type GetRequest<T extends Method> =
  | Extract<Parameters<T>[number], jspb.Message>
  | UnpackRequest<ReturnType<T>>;

type UnpackResponse<T> =
  | T extends PromiseLike<infer U> ? U : never
  | T extends grpc.ClientDuplexStream<infer U, infer S> ? grpc.ServerDuplexStream<S, U> : never
  | T extends grpc.ClientReadableStream<infer U> ? grpc.ServerReadableStream<U> : never;

type GetResponse<T extends Method> = UnpackResponse<ReturnType<T>>;

interface Get<T extends IsServiceFile<T>> {
  file: IsServiceFile<T>;
  class: ValueOf<Get<T>["file"]>;
  service: InstanceType<Get<T>["class"]>;

  // own properties, excludes everyhing in grpc.Client
  properties: GetOwnProperties<Get<T>["service"], grpc.Client>;
  methods: PickProperties<Get<T>["properties"], Method>;
}

type GrpcCall<R = any, W = any> =
  grpc.ServerUnaryCall<R> |
  grpc.ServerReadableStream<R> |
  grpc.ServerWriteableStream<R> |
  grpc.ServerDuplexStream<R, W>

type UseCallback<T extends IsServiceFile<T>, V extends Method> = (
  ctx: Mali.Context<T, GetRequest<V>, GetResponse<V>>,
  next: () => Promise<any>
) => void | Promise<void>;
type UseObject<T extends IsServiceFile<T>> = {
  [K in keyof Get<T>["methods"]]?: UseCallback<
    T,
    IsMethod<Get<T>["methods"][K]>
  >
};
type UseObjectGeneric<T extends IsServiceFile<T>> = {
  [key: string]: UseObject<T>
}

declare class Mali<T extends IsServiceFile<T> = any> extends EventEmitter {
  constructor(service: T, name?: string, options?: any);
  constructor(path: string, name?: string | ReadonlyArray<string>, options?: any);

  name: string;
  env: string;
  ports: ReadonlyArray<number>;
  silent: boolean;
  context: Mali.Context<T, undefined, undefined>

  addService (path: any, name: string | ReadonlyArray<string>, options?: any): void;
  // use (service?: any, name?: any, fns?: any): void;

  use (fn: UseCallback<T, IsMethod<ValueOf<Get<T>["properties"]>>>): void;

  /* "why?" ... you ask?, https://github.com/microsoft/TypeScript/issues/32550 */
  use <K extends keyof Get<T>["methods"], V extends IsMethod<Get<T>["methods"][K]>>(
    name: K,
    fn: UseCallback<T, V> | UseCallback<T, V>[],
  ): void;
  use <K extends keyof Get<T>["methods"], V extends IsMethod<Get<T>["methods"][K]>>(
    name: K,
    ...fn: UseCallback<T, V>[],
  ): void;
  use (object: UseObject<T>): void;

  use <K extends keyof Get<T>["methods"], V extends IsMethod<Get<T>["methods"][K]>>(
    service: string,
    name: K,
    fn: UseCallback<T, V> | UseCallback<T, V>[],
  ): void;
  use <K extends keyof Get<T>["methods"], V extends IsMethod<Get<T>["methods"][K]>>(
    service: string,
    name: K,
    ...fn: UseCallback<T, V>[],
  ): void;

  // TODO: remove that
  use (object: UseObjectGeneric<T>): void;


  start (port: number | string, creds?: any, options?: any): grpc.Server;
  toJSON (): any;
  close (): Promise<void>;
  inspect (): any;
}

declare namespace Mali {
  type Methods<T extends IsServiceFile<T>> = {
    [K in keyof Get<T>['methods']]: UseCallback<T, IsMethod<Get<T>['methods'][K]>>;
  };
  interface Context<App extends IsServiceFile<App> = any, Req = any, Res = any> {
    name: string;
    fullName: string;
    service: string;
    package: string;
    app: Mali<App>;
    call: GrpcCall<Req, Res>;
    request: Request<Req>;
    response: Response<Req>;
    req: Req;
    res: Res;
    type: string;
    metadata: any;
    get (field: string): any;
    set (field: any, val?: any): void;
    sendMetadata (md: any): void;
    getStatus (field: string): any;
    setStatus (field: any, val?: any): void;
  }
  class Request<T> {
    constructor(call: any, type: string);
    call: GrpcCall;
    type: string;
    metadata: any;
    req: T;

    getMetadata (): grpc.Metadata;
    get (field: string): any;
  }

  class Response<T> {
    constructor(call: any, type: string);
    call: GrpcCall;
    type: string;
    metadata: any;
    status: any;
    res: T;
    set (field: any, val?: any): void;
    get (field: string): any;
    getMetadata (): grpc.Metadata;
    sendMetadata (md?: any): void;
    getStatus (field: string): any;
    setStatus (field: any, val?: any): void;
  }

}

export = Mali;
